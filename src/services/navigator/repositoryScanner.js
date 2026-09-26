const fs = require('fs');
const path = require('path');

// Directories and files to exclude from the visual tree
const IGNORED_NAMES = new Set([
  'node_modules',
  '.git',
  '.gemini',
  '.idea',
  '.vscode',
  'npm-debug.log',
  'package-lock.json',
  '.DS_Store'
]);

// Curated architectural descriptions for repository elements
const FILE_DESCRIPTIONS = {
  'src': 'Core application source code',
  'server.js': 'Express HTTP & SSE server entrypoint and route mounter',
  'config': 'Environment variables and system configuration loader',
  'contracts': 'JSON Schema definitions and mock UI fixtures',
  'responseSchema.json': 'JSON schema contract for 13 interactive UI widgets',
  'fixtures': 'Mock sample payloads for all widget contracts',
  'prompts': 'System prompts and intent templates for all subagents',
  'promptTemplates.js': 'Subagent prompts with strict JSON schema instructions',
  'routes': 'API route handlers for query, stream, docs, and audio',
  'query.js': 'POST /api/query structured widget endpoint',
  'stream.js': 'GET & POST /api/stream Server-Sent Events endpoint',
  'sessions.js': 'GET & DELETE /api/sessions/:id conversation endpoints',
  'docs.js': 'Automated documentation proposal and approval routes',
  'audio.js': 'POST /api/audio/synthesize spoken briefing endpoint',
  'scripts': 'Automated verification and test suites',
  'test-rag-pipeline.js': 'ChromaDB retrieval and schema validation test',
  'test-learning-suite.js': 'Test suite for Quiz, Flashcards, Tutorial & Learning Path',
  'test-docgen.js': 'Test suite for automated doc proposal generation',
  'services': 'Business logic, AI agents, RAG pipeline, and integrations',
  'agents': 'IBM BeeAI multi-agent supervisor and subagent runner',
  'supervisor.js': 'Supervisor agent: intent classification & subagent delegation',
  'runSubagent.js': 'Generic subagent runner with automatic ElevenLabs hook',
  'audio': 'Spoken technical briefings and TTS synthesis',
  'ttsService.js': 'ElevenLabs Turbo v2.5 and IBM Watson TTS audio service',
  'enrichment': 'Real-time external documentation lookup (MDN, npm, RFC)',
  'contextEnricher.js': 'Fetches live reference documentation to enrich prompts',
  'groq': 'Groq LPU ultra-fast LLM inference engine',
  'generator.js': 'Groq chat completion client (gpt-oss-120b)',
  'memory': 'Multi-turn session history and sliding context window',
  'sessionMemory.js': 'In-memory turn store with sliding 10-turn window',
  'rag': 'Vector retrieval, chunking, and JSON output parsing',
  'pipeline.js': 'Main RAG orchestrator combining retrieval and supervisor',
  'retriever.js': 'ChromaDB ANN vector retrieval with graceful fallback',
  'jsonParser.js': 'Markdown fence stripper, JSON parser, and schema repair',
  'watsonx': 'IBM watsonx.ai client, IAM auth caching, and Granite models',
  'auth.js': 'IBM Cloud IAM OAuth token caching service',
  'client.js': 'HTTP client for watsonx foundation models API',
  'embeddings.js': 'watsonx embedding generator (Granite / Slate)',
  'public': 'Developer canvas frontend and interactive widget renderers',
  'index.html': 'TRACiE developer canvas single-page interface',
  'app.js': 'Real-time SSE event client and dynamic widget renderer',
  'styles.css': 'Glassmorphic dark-mode UI stylesheet',
  'package.json': 'Project manifest, npm scripts, and dependencies',
  'README.md': 'Project overview, architecture diagrams, and quickstart guide',
  '.env.example': 'Template for Groq, watsonx, and ElevenLabs API keys',
  '.gitignore': 'Git ignore rules for secrets, node_modules, and UI files'
};

/**
 * Recursively scans directory and builds hierarchical file tree object.
 *
 * @param {string} dirPath - Absolute path to directory.
 * @param {string} [name='TRACiE'] - Node display name.
 * @param {number} [depth=0] - Recursion depth.
 * @returns {object} Tree node matching the file_tree contract.
 */
function scanDirectory(dirPath, name = 'TRACiE', depth = 0) {
  if (depth > 6) return null;

  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) {
    return {
      name,
      type: 'file',
      description: FILE_DESCRIPTIONS[name] || ''
    };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const children = [];

  // Sort directories first, then files
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    if (IGNORED_NAMES.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.gitignore') continue;
    if (entry.name.endsWith('.mp3')) continue;

    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        const subTree = scanDirectory(fullPath, entry.name, depth + 1);
        if (subTree) children.push(subTree);
      } else {
        children.push({
          name: entry.name,
          type: 'file',
          description: FILE_DESCRIPTIONS[entry.name] || ''
        });
      }
    } catch {
      // Ignore unreadable files
    }
  }

  return {
    name,
    type: 'directory',
    description: FILE_DESCRIPTIONS[name] || (depth === 0 ? 'Full Repository Layout' : ''),
    children
  };
}

/**
 * Returns the complete file tree of the TRACiE repository.
 *
 * @param {string} [workspaceRoot] - Optional root path.
 * @returns {object} Complete file_tree widget root.
 */
function getCompleteRepositoryTree(workspaceRoot) {
  const root = workspaceRoot || path.resolve(__dirname, '../../../');
  return scanDirectory(root, 'TRACiE');
}

/**
 * Formats the entire repository file tree into a plain text manifest for LLM prompts.
 *
 * @param {object} node
 * @param {string} [indent='']
 * @returns {string}
 */
function formatTreeAsText(node, indent = '') {
  if (!node) return '';
  let line = `${indent}${node.type === 'directory' ? '📁' : '📄'} ${node.name}`;
  if (node.description) line += ` - ${node.description}`;
  line += '\n';

  if (node.children) {
    for (const child of node.children) {
      line += formatTreeAsText(child, indent + '  ');
    }
  }
  return line;
}

module.exports = {
  scanDirectory,
  getCompleteRepositoryTree,
  formatTreeAsText
};
