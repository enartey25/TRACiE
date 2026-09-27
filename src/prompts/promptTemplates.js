const { SYSTEM_PROMPT } = require('./systemPrompt');
const {
  getCompleteRepositoryTree,
  getCanonicalFastApiTree,
  formatTreeAsText
} = require('../services/navigator/repositoryScanner');

/**
 * Formats retrieved code chunks into a structured context block for the LLM.
 * @param {Array<object>} chunks - List of code chunks from ChromaDB.
 * @returns {string} - Formatted context string.
 */
function formatCodeChunks(chunks) {
  if (!chunks || chunks.length === 0) {
    return 'NO RELEVANT CODE CHUNKS FOUND IN THE VECTOR DATABASE.';
  }

  return chunks
    .map((chunk, index) => {
      const file = chunk.file_path || chunk.metadata?.file_path || 'Unknown file';
      const start = chunk.start_line || chunk.metadata?.start_line || 1;
      const end = chunk.end_line || chunk.metadata?.end_line || '?';
      const lang = chunk.language || chunk.metadata?.language || '';
      const content = chunk.content || chunk.chunk_text || chunk.document || '';

      return `--- CHUNK ${index + 1}: ${file} (Lines ${start}-${end}) [${lang}] ---\n${content}\n`;
    })
    .join('\n');
}

/**
 * Builds the complete prompt for the watsonx.ai text generation endpoint.
 * @param {object} params
 * @param {string} params.query - The user's natural language question.
 * @param {Array<object>} params.chunks - Retrieved code chunks.
 * @param {Array<object>} [params.conversationHistory] - Prior turns.
 * @param {string} [params.externalContext] - Enriched docs.
 * @returns {string} - Final assembled prompt string.
 */
function buildRAGPrompt({ query, chunks, conversationHistory = [], externalContext = '' }) {
  const contextBlock = formatCodeChunks(chunks);

  let historyBlock = '';
  if (conversationHistory && conversationHistory.length > 0) {
    historyBlock = `\nPRIOR CONVERSATION HISTORY:\n` +
      conversationHistory
        .map(h => `${h.role === 'user' ? 'Developer' : 'Assistant'}: ${h.text || JSON.stringify(h.content)}`)
        .join('\n') +
      `\n`;
  }

  return `${SYSTEM_PROMPT}

==============================
CODEBASE CONTEXT CHUNKS:
==============================
${contextBlock}
${historyBlock}
${externalContext}
==============================
DEVELOPER QUERY:
==============================
${query}

REMINDER: Return ONLY a valid JSON object matching the contract specification. No extra text or markdown wrapping.`;
}

// ---------------------------------------------------------------------------
// Specialized Subagent Prompts
// ---------------------------------------------------------------------------

function resolveTargetRepoName({ query = '', repoName = '', chunks = [] }) {
  const qLower = (query || '').toLowerCase();
  if (repoName && repoName !== 'TRACiE' && repoName !== 'the repository') return repoName;
  if (qLower.includes('pandas')) return 'pandas-dev/pandas';
  if (qLower.includes('fastapi')) return 'fastapi/fastapi';
  if (chunks && chunks.length > 0) {
    const firstPath = chunks[0].file_path || '';
    if (firstPath.startsWith('pandas/') || firstPath.includes('pandas')) return 'pandas-dev/pandas';
    if (firstPath.startsWith('fastapi/') || firstPath.includes('fastapi')) return 'fastapi/fastapi';
  }
  return repoName || 'the repository';
}

function buildArchitectPrompt({ query, chunks = [], repoName, repositoryTree, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  const isFastApi = targetName.toLowerCase().includes('fastapi');
  const isTracie = targetName === 'TRACiE' && query.toLowerCase().includes('tracie');
  const tree = repositoryTree || (isFastApi ? getCanonicalFastApiTree() : (isTracie ? getCompleteRepositoryTree() : null));
  const manifest = tree
    ? formatTreeAsText(tree)
    : (chunks.length > 0 ? Array.from(new Set(chunks.map(c => c.file_path))).map(p => `- ${p}`).join('\n') : `Files for ${targetName}`);

  return `You are the Architect Subagent in the TRACiE multi-agent system.
Your mission is to generate comprehensive, publication-grade Mermaid.js diagrams visualizing the ${targetName} codebase.

CRITICAL REPOSITORY SCOPE RULES:
- ALL components, nodes, subgraphs, files, classes, endpoints, and data flows MUST be 100% about ${targetName}.
- Do NOT output components, files, or architecture for TRACiE itself unless ${targetName} is explicitly TRACiE.
- Ground your diagram in the provided ${targetName} code chunks and module manifest.

CODEBASE MODULE MANIFEST (${targetName}):
${manifest}

RETRIEVED CODE CHUNKS (${targetName}):
${context}
${conversationHistory ? `\nPRIOR TURNS:\n${conversationHistory}\n` : ''}

USER QUERY:
${query}

DIAGRAM SELECTION RULES:
1. SEQUENCE DIAGRAM: If the user asks for a sequence diagram, interaction flow, or step-by-step execution timeline for ${targetName}:
   - Use "sequenceDiagram" syntax with "autonumber" and actors/participants representing components in ${targetName}.
   - Use activations (activate/deactivate), solid/dashed arrows (->>, -->>), and note boxes.

2. ER / SCHEMA DIAGRAM: If the user asks for an ER diagram, database schema, entity relationships, or data model for ${targetName}:
   - Use "erDiagram" syntax.
   - Define entities with fields, types, and primary/foreign keys from ${targetName}.
   - Show cardinality links (||--o{, }|--||, ||--||) and relation labels.

3. UML / CLASS DIAGRAM: If the user asks for UML, class hierarchy, interfaces, or object models in ${targetName}:
   - Use "classDiagram" syntax.
   - Define classes with public (+) and private (-) properties and methods with signatures.
   - Show inheritance (<|--), composition (*--), and association (-->).

4. CONNECTED SYSTEM TOPOLOGY: If the user asks for repository layout, component connections, or system architecture for ${targetName}:
   - Use "flowchart TD" or "flowchart LR" with subgraphs grouping subsystems in ${targetName}.
   - Show labeled connection paths showing exact protocols, function calls, and data flows.

MERMAID SYNTAX STRICT RULES:
- Always use valid, clean Mermaid DSL without markdown code blocks inside the JSON string (escape newlines as \\n).
- Always quote node labels containing spaces, parentheses, or brackets: Node["Label (Extra Info)"].
- Keep node IDs alphanumeric without spaces.

OUTPUT JSON FORMAT (STRICT — field names are EXACT, do NOT use "diagram", "mermaid_code", "dsl", or any other alias):
{
  "type": "architecture_diagram",
  "title": "${targetName} Architecture Diagram",
  "diagram_source": "Mermaid DSL string — THIS FIELD MUST BE NAMED diagram_source, not diagram",
  "caption": "Clear architectural explanation of the ${targetName} diagram components and data flow"
}

CRITICAL: The Mermaid DSL MUST go in the "diagram_source" field. Never use "diagram", "mermaid_code", "code", "dsl", or any other key name.`;
}

function buildCodeExplainerPrompt({ query, chunks = [], repoName, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n');
  return `You are the Code Explainer Subagent in the TRACiE multi-agent system.
Inspect the code chunks from ${targetName} and present the specific implementation answering the query.
All explanations, file paths, and citations must be strictly about ${targetName}.
${conversationHistory ? `\nPRIOR TURNS:\n${conversationHistory}\n` : ''}
CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "code_snippet",
  "file_path": "Path to primary source file in ${targetName}",
  "language": "python or javascript or appropriate",
  "start_line": 1,
  "end_line": 35,
  "code": "Exact or cleaned code snippet from ${targetName}",
  "explanation": "Clear explanation of how the ${targetName} code works"
}`;
}

function buildNavigatorPrompt({ query, repoName, repositoryTree, chunks = [] }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const isFastApi = targetName.toLowerCase().includes('fastapi');
  const isTracie = targetName === 'TRACiE' && (query || '').toLowerCase().includes('tracie');

  const tree = repositoryTree || (isFastApi ? getCanonicalFastApiTree() : (isTracie ? getCompleteRepositoryTree() : null));
  const manifest = tree
    ? formatTreeAsText(tree)
    : (chunks.length > 0 ? Array.from(new Set(chunks.map(c => c.file_path))).map(p => `- ${p}`).join('\n') : `Files for ${targetName}`);

  return `You are the Navigator Subagent in the TRACiE multi-agent system.
Your goal is to present the complete, accurate hierarchical file tree and directory structure of the ${targetName} codebase.

ENTIRE ${targetName.toUpperCase()} REPOSITORY FILE STRUCTURE & DESCRIPTIONS:
${manifest}

USER QUERY:
${query}

CRITICAL REQUIREMENT:
Return a JSON object with the file tree corresponding strictly to ${targetName}.
Do NOT output files or directories belonging to any other project.
Every single folder and file must represent the actual directory structure of ${targetName}.

Format:
{
  "type": "file_tree",
  "title": "${targetName} Repository Layout",
  "root": ${JSON.stringify(tree || { name: targetName, type: 'directory', children: [] }, null, 2)}
}`;
}

// Quiz length: the number the user asked for ("quiz me with 8 questions"), else a default.
// Capped so every question still fits in the smallest provider's output budget.
const QUIZ_DEFAULT_QUESTIONS = 5;
const QUIZ_MAX_QUESTIONS = 8;

function resolveQuizQuestionCount(query = '') {
  const match = String(query).match(/\b(\d{1,2})[\s-]*(?:questions?|qs?|mcqs?)\b/i);
  const requested = match ? parseInt(match[1], 10) : QUIZ_DEFAULT_QUESTIONS;
  return Math.min(QUIZ_MAX_QUESTIONS, Math.max(1, requested || QUIZ_DEFAULT_QUESTIONS));
}

function buildQuizPrompt({ query, chunks = [], repoName, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  const count = resolveQuizQuestionCount(query);
  const plural = count === 1 ? '' : 's';
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate an onboarding quiz of exactly ${count} multiple-choice question${plural} testing developer comprehension of the actual ${targetName} codebase logic.
All questions, options, and explanations must strictly test understanding of ${targetName}. Under no circumstances should questions be about TRACiE unless ${targetName} is TRACiE.
${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
- Exactly ${count} question${plural} in the "questions" array.
- Each question tests a different concept, file or behaviour; never repeat or rephrase a question.
- Each question has exactly 4 plausible options, and the position of the correct answer varies across questions.
- Keep each explanation to 1-2 sentences grounded in the code chunks.

Return a JSON object:
{
  "type": "quiz",
  "title": "Short quiz title about ${targetName}",
  "questions": [
    {
      "question": "Clear question testing developer understanding of ${targetName}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct based on the ${targetName} codebase implementation",
      "code_context": "Relevant file path in ${targetName}"
    }
  ]
}
IMPORTANT: In every question the property must be named "correct_index" (NOT "correct_option" or "answer") and MUST be a 0-based integer from 0 to 3 corresponding to the correct option index in that question's "options" array.`;
}

function buildFlashcardDeckPrompt({ query, chunks = [], repoName, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a deck of interactive flashcards (3 to 5 cards) covering key concepts in the ${targetName} codebase.
All flashcards must strictly cover ${targetName}.
${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "flashcard_deck",
  "title": "${targetName} Core Concepts Flashcards",
  "description": "Key concepts and mechanisms in ${targetName}",
  "cards": [
    {
      "id": "card-1",
      "front": "Concept or Question about ${targetName}",
      "back": "Detailed answer explaining the ${targetName} code mechanism",
      "tag": "Architecture or Core or Module",
      "citation": "source/file"
    }
  ]
}`;
}

function buildTutorialStepsPrompt({ query, chunks = [], repoName, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a step-by-step developer tutorial for performing a task in the ${targetName} codebase.
${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "tutorial_steps",
  "title": "${targetName} Developer Tutorial",
  "description": "Overview of what developer will accomplish in ${targetName}",
  "prerequisites": ["List of requirements"],
  "steps": [
    {
      "step_number": 1,
      "title": "Step Title",
      "instructions": "Clear instruction for ${targetName}",
      "code": "Optional code snippet",
      "file_path": "Target file path in ${targetName}"
    }
  ]
}`;
}

function buildLearningPathPrompt({ query, chunks = [], repoName }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a comprehensive, ordered developer onboarding curriculum for the ${targetName} codebase.
All modules and milestones must be strictly about ${targetName}.

CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "learning_path",
  "title": "${targetName} Developer Onboarding Curriculum",
  "description": "Curriculum overview for contributing to ${targetName}",
  "target_role": "Engineer / Contributor",
  "estimated_hours": 4.5,
  "modules": [
    {
      "module_id": "mod-1",
      "title": "Module Title",
      "description": "Module summary in ${targetName}",
      "topics": ["Topic 1", "Topic 2"],
      "milestones": ["Milestone 1 to accomplish"]
    }
  ]
}`;
}

function buildDocProposalPrompt({ query, chunks = [], repoName, diffInput = '', conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the DocWriter Subagent in the TRACiE multi-agent system.
Analyze code modifications and generate a structured documentation update proposal with a unified diff for the ${targetName} codebase.
${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
CODEBASE CONTEXT (${targetName}):
${context}

CHANGED CODE OR DIFF:
${diffInput || query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "doc_proposal",
  "proposal_id": "prop-${Date.now()}",
  "target_file": "README.md",
  "diff_markdown": "--- a/README.md\\n+++ b/README.md\\n@@ -10,3 +10,6 @@\\n Existing content\\n+New documentation content added",
  "rationale": "Why this documentation update is needed in ${targetName}",
  "pr_title": "docs: update README for ${targetName}",
  "pr_body": "Detailed pull request description explaining doc updates in ${targetName}",
  "affected_components": ["List of components in ${targetName}"]
}`;
}

function buildAudioBriefingPrompt({ query, chunks = [], repoName, conversationHistory = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Audio Subagent in the TRACiE multi-agent system.
Your mission is to generate a natural, engaging, and conversational spoken audio briefing script that DIRECTLY ANSWERS the USER QUERY for the ${targetName} codebase.

CRITICAL INSTRUCTIONS:
- Directly focus on ${targetName} and the topic requested in USER QUERY.
- NEVER talk about TRACiE's own architecture or codebase unless ${targetName} is TRACiE.
- The title must reflect the actual topic in ${targetName} (e.g. "Audio Briefing: ${targetName} Architecture & Core Flows").
- The transcript must sound conversational, natural, and engaging--like a senior tech lead explaining the subsystem directly to a teammate.
- Avoid reading out raw punctuation, code brackets, or raw SQL syntax verbatim; explain the concepts smoothly.
- Provide a clear subtitle and description summarizing the spoken audio content.

${conversationHistory ? `PRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}

CODEBASE CONTEXT (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "audio_player",
  "title": "Audio Briefing: ${targetName} Walkthrough",
  "subtitle": "Spoken overview and technical walkthrough of ${targetName}",
  "description": "Short 1-2 sentence description of what is covered in this ${targetName} briefing",
  "transcript": "Natural spoken explanation directly answering the user's specific query about ${targetName}...",
  "audio_url": "",
  "duration_seconds": 25.0
}`;
}

function buildGeneralQAPrompt({ query, chunks = [], repoName, conversationHistory = '', externalContext = '' }) {
  const targetName = resolveTargetRepoName({ query, repoName, chunks });
  const context = chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n');
  return `You are the General QA Subagent in the TRACiE multi-agent system.
Your mission is to answer the developer question strictly based on the target repository: ${targetName} and the provided code chunks.

CRITICAL REPOSITORY SCOPE RULES:
1. Every answer, explanation, file reference, and code citation MUST be about ${targetName}.
2. Under NO circumstances should you discuss, refer to, or introduce TRACiE's internal architecture, team, or Node.js services. You are an AI assistant analyzing the codebase of ${targetName}.
3. If the user asks general questions like "What is this repo?" or "How does the directory look?", answer exclusively about ${targetName}.

${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
${externalContext ? `\n${externalContext}\n` : ''}
CODE CHUNKS (${targetName}):
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "chat_response",
  "content": "Comprehensive markdown explanation regarding ${targetName}",
  "citations": [
    {
      "file_path": "File path in ${targetName}",
      "start_line": 1,
      "end_line": 20,
      "snippet": "Relevant code snippet from ${targetName}"
    }
  ],
  "external_references": [
    {
      "title": "Documentation Title",
      "url": "https://...",
      "source": "MDN or npm or official_docs",
      "description": "Brief description"
    }
  ]
}`;
}

module.exports = {
  formatCodeChunks,
  buildRAGPrompt,
  buildArchitectPrompt,
  buildCodeExplainerPrompt,
  buildNavigatorPrompt,
  buildQuizPrompt,
  buildFlashcardDeckPrompt,
  buildTutorialStepsPrompt,
  buildLearningPathPrompt,
  buildDocProposalPrompt,
  buildAudioBriefingPrompt,
  buildGeneralQAPrompt,
};
