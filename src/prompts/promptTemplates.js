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
 * @param {Array<object>} [params.conversationHistory] - Prior turns (for Phase 2).
 * @returns {string} - Final assembled prompt string.
 */
function buildRAGPrompt({ query, chunks, conversationHistory = [] }) {
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
==============================
DEVELOPER QUERY:
==============================
${query}

REMINDER: Return ONLY a valid JSON object matching the contract specification. No extra text or markdown wrapping.`;
}

module.exports = {
  formatCodeChunks,
  buildRAGPrompt
};
