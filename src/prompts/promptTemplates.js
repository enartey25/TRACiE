const { SYSTEM_PROMPT } = require('./systemPrompt');

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

function buildArchitectPrompt({ query, chunks, conversationHistory = '' }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Architect Subagent in the TRACiE multi-agent system.
Based on the code chunks, generate a valid Mermaid.js architecture diagram.
${conversationHistory ? `\nPRIOR TURNS:\n${conversationHistory}\n` : ''}
CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "architecture_diagram",
  "title": "Clear Diagram Title",
  "diagram_source": "Valid Mermaid DSL e.g. graph TD\\n  A-->B",
  "caption": "Explanation of the architecture"
}`;
}

function buildCodeExplainerPrompt({ query, chunks, conversationHistory = '' }) {
  const context = chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n');
  return `You are the Code Explainer Subagent in the TRACiE multi-agent system.
Inspect the code chunks and present the specific implementation answering the query.
${conversationHistory ? `\nPRIOR TURNS:\n${conversationHistory}\n` : ''}
CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "code_snippet",
  "file_path": "Path to primary source file",
  "language": "javascript",
  "start_line": 1,
  "end_line": 35,
  "code": "Exact or cleaned code snippet",
  "explanation": "Clear explanation of how the code works"
}`;
}

function buildNavigatorPrompt({ query, chunks }) {
  const filePaths = chunks.map(c => `[File: ${c.file_path}]`).join('\n');
  return `You are the Navigator Subagent in the TRACiE multi-agent system.
Generate a hierarchical file tree representing the project structure.

CODE CHUNKS:
${filePaths}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "file_tree",
  "title": "Repository Structure",
  "root": {
    "name": "TRACiE",
    "type": "directory",
    "children": [
      {
        "name": "src",
        "type": "directory",
        "children": [
          { "name": "server.js", "type": "file" },
          { "name": "routes", "type": "directory", "children": [] }
        ]
      },
      { "name": "package.json", "type": "file" }
    ]
  }
}`;
}

function buildQuizPrompt({ query, chunks }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate an onboarding quiz testing developer comprehension of the actual codebase logic.

CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "quiz",
  "question": "Clear question testing developer understanding of this codebase",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correct_index": 0,
  "explanation": "Why this answer is correct based on the codebase implementation",
  "code_context": "Relevant file path"
}`;
}

function buildFlashcardDeckPrompt({ query, chunks }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a deck of interactive flashcards (3 to 5 cards) covering key concepts in this codebase.

CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "flashcard_deck",
  "title": "Clear Deck Title",
  "description": "Brief description of topics covered",
  "cards": [
    {
      "id": "card-1",
      "front": "Concept or Question",
      "back": "Detailed answer explaining the code mechanism",
      "tag": "Architecture or Middleware or Routing",
      "citation": "source/file.js"
    }
  ]
}`;
}

function buildTutorialStepsPrompt({ query, chunks }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a step-by-step developer tutorial for performing a task in this codebase.

CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "tutorial_steps",
  "title": "Tutorial Title (e.g. How to Add a New Route)",
  "description": "Overview of what developer will accomplish",
  "prerequisites": ["List of requirements"],
  "steps": [
    {
      "step_number": 1,
      "title": "Step Title",
      "instructions": "Clear instruction",
      "code": "Optional code to write or edit",
      "file_path": "Target file path"
    }
  ]
}`;
}

function buildLearningPathPrompt({ query, chunks }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Curriculum Subagent in the TRACiE multi-agent system.
Generate a comprehensive, ordered developer onboarding curriculum.

CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "learning_path",
  "title": "Developer Onboarding Curriculum",
  "description": "Curriculum overview",
  "target_role": "Backend Engineer / Contributor",
  "estimated_hours": 4.5,
  "modules": [
    {
      "module_id": "mod-1",
      "title": "Module Title",
      "description": "Module summary",
      "topics": ["Topic 1", "Topic 2"],
      "milestones": ["Milestone 1 to accomplish"]
    }
  ]
}`;
}

function buildDocProposalPrompt({ query, chunks, diffInput = '' }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the DocWriter Subagent in the TRACiE multi-agent system.
Analyze code modifications and generate a structured documentation update proposal with a unified diff.

CODEBASE CONTEXT:
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
  "rationale": "Why this documentation update is needed based on the code changes",
  "pr_title": "docs: update README with new functionality",
  "pr_body": "Detailed pull request description explaining doc updates",
  "affected_components": ["List of components"]
}`;
}

function buildAudioBriefingPrompt({ query, chunks }) {
  const context = chunks.map(c => `[File: ${c.file_path}]\n${c.content}`).join('\n\n');
  return `You are the Audio Subagent in the TRACiE multi-agent system.
Generate a natural, spoken audio briefing script explaining the codebase architecture.

CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "audio_player",
  "title": "Audio Briefing: Codebase Architecture",
  "transcript": "Natural spoken explanation intended for text-to-speech audio synthesis...",
  "audio_url": "https://actions.google.com/sounds/v1/science_fiction/scifi_hum.ogg",
  "duration_seconds": 25.0
}`;
}

function buildGeneralQAPrompt({ query, chunks, conversationHistory = '', externalContext = '' }) {
  const context = chunks.map(c => `[File: ${c.file_path} (Lines ${c.start_line}-${c.end_line})]\n${c.content}`).join('\n\n');
  return `You are the General QA Subagent in the TRACiE multi-agent system.
Answer the developer question strictly based on the provided code chunks.
${conversationHistory ? `\nPRIOR CONVERSATION HISTORY:\n${conversationHistory}\n` : ''}
${externalContext ? `\n${externalContext}\n` : ''}
CODE CHUNKS:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "chat_response",
  "content": "Comprehensive markdown explanation",
  "citations": [
    {
      "file_path": "File path",
      "start_line": 1,
      "end_line": 20,
      "snippet": "Relevant code snippet"
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
