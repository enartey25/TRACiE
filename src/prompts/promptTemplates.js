const { SYSTEM_PROMPT } = require('./systemPrompt');
const { getCompleteRepositoryTree, formatTreeAsText } = require('../services/navigator/repositoryScanner');

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
  const tree = getCompleteRepositoryTree();
  const manifest = formatTreeAsText(tree);

  return `You are the Architect Subagent in the TRACiE multi-agent system.
Your mission is to generate comprehensive, publication-grade Mermaid.js diagrams visualizing the TRACiE codebase.

CODEBASE MODULE MANIFEST:
${manifest}

RETRIEVED CODE CHUNKS:
${context}
${conversationHistory ? `\nPRIOR TURNS:\n${conversationHistory}\n` : ''}

USER QUERY:
${query}

DIAGRAM SELECTION RULES:
1. SEQUENCE DIAGRAM: If the user asks for a sequence diagram, interaction flow, or step-by-step execution timeline:
   - Use "sequenceDiagram" syntax with "autonumber" and actors/participants (e.g. Developer, UI, Server, Supervisor, ChromaDB, Groq, ElevenLabs).
   - Use activations (activate/deactivate), solid/dashed arrows (->>, -->>), and note boxes.

2. ER / SCHEMA DIAGRAM (SUPABASE STYLE): If the user asks for an ER diagram, database schema, entity relationships, or data model:
   - Use "erDiagram" syntax.
   - Define entities with fields, types, and primary/foreign keys (e.g. USERS, SESSIONS, QUERIES, CODE_CHUNKS, DOC_PROPOSALS).
   - Show cardinality links (||--o{, }|--||, ||--||) and relation labels.

3. UML / CLASS DIAGRAM: If the user asks for UML, class hierarchy, interfaces, or object models:
   - Use "classDiagram" syntax.
   - Define classes with public (+) and private (-) properties and methods with signatures.
   - Show inheritance (<|--), composition (*--), and association (-->).

4. CONNECTED SYSTEM TOPOLOGY (SUPABASE-STYLE MODULE MAP): If the user asks for repository layout, component connections, or system architecture:
   - Use "flowchart TD" or "flowchart LR" with subgraphs grouping subsystems (e.g., Presentation, API Routes, BeeAI Supervisor, RAG Core, External Services).
   - Show labeled connection paths showing exact protocols, HTTP methods, and data contracts (e.g. -->|HTTP POST /api/query|, -->|SSE EventStream|).

MERMAID SYNTAX STRICT RULES:
- Always use valid, clean Mermaid DSL without markdown code blocks inside the JSON string (escape newlines as \\n).
- Always quote node labels containing spaces, parentheses, or brackets: Node["Label (Extra Info)"].
- Keep node IDs alphanumeric without spaces.

OUTPUT JSON FORMAT:
{
  "type": "architecture_diagram",
  "title": "Descriptive Diagram Title",
  "diagram_source": "Mermaid DSL string",
  "caption": "Clear architectural explanation of the diagram components and data flow"
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

function buildNavigatorPrompt({ query }) {
  const tree = getCompleteRepositoryTree();
  const manifest = formatTreeAsText(tree);

  return `You are the Navigator Subagent in the TRACiE multi-agent system.
Your goal is to present the complete, comprehensive hierarchical file tree of the TRACiE codebase.

ENTIRE REPOSITORY FILE STRUCTURE & DESCRIPTIONS:
${manifest}

USER QUERY:
${query}

CRITICAL REQUIREMENT:
Return a JSON object with the FULL repository tree (including public, src, config, contracts, prompts, routes, scripts, services, agents, rag, watsonx, etc.).
Do NOT truncate or omit directories or files. Every single folder and file from the manifest must be included in the children array.

Format:
{
  "type": "file_tree",
  "title": "Complete TRACiE Repository Layout",
  "root": ${JSON.stringify(tree, null, 2)}
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
Your mission is to generate a natural, conversational spoken audio briefing script that DIRECTLY ANSWERS the USER QUERY.

CRITICAL INSTRUCTIONS:
- Directly focus on the topic requested in USER QUERY (e.g. if the user asked about the database, explain TRACiE's dual database architecture: ChromaDB for 768-dim vector embeddings and PostgreSQL for relational sessions, queries, and doc proposals).
- Do NOT provide a generic server overview unless the user specifically asked for a general overview.
- The transcript must sound conversational, natural, and engaging—like a senior tech lead or podcast host explaining the subsystem directly to a teammate.
- Avoid reading out raw punctuation, code brackets, or raw SQL syntax verbatim; explain the concepts smoothly.

CODEBASE CONTEXT:
${context}

USER QUERY:
${query}

REQUIREMENTS:
Return a JSON object:
{
  "type": "audio_player",
  "title": "Audio Briefing: [Specific Topic from User Query]",
  "transcript": "Natural spoken explanation directly answering the user's specific query...",
  "audio_url": "",
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
