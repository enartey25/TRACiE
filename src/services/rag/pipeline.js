const { generateEmbedding } = require('../watsonx/embedding');
const { generateText } = require('../watsonx/generator');
const { retrieveCodeChunks } = require('./retriever');
const { buildRAGPrompt } = require('../../prompts/promptTemplates');
const { parseAndValidateWidgetJSON } = require('./jsonParser');
const { orchestrateAgents } = require('../agents/supervisor');

/**
 * Executes the complete RAG Query Pipeline for developer queries.
 * Routes through the IBM Bee-Style Multi-Agent system when Groq is active,
 * or through the direct watsonx.ai client.
 *
 * @param {object} params
 * @param {string} params.query - Developer natural language question.
 * @param {string} [params.repoId] - Target repository identifier.
 * @param {string} [params.sessionId] - Conversation session identifier.
 * @param {Array<object>} [params.conversationHistory] - Prior turns.
 * @param {Function} [params.onThought] - Callback for agent thoughts and streaming events.
 * @returns {Promise<object>} - Validated UI Widget JSON object.
 */
async function executeRAGQuery({ query, repoId, sessionId, conversationHistory = [], onThought }) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string.');
  }

  const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();

  // 1. Vectorize the incoming query
  const queryEmbedding = await generateEmbedding(query);

  // 2. Retrieve top-k nearest code chunks from ChromaDB
  const chunks = await retrieveCodeChunks({
    queryEmbedding,
    repoId,
    topK: 5
  });

  const fallbackCitations = chunks.map(c => ({
    file_path: c.file_path,
    start_line: c.start_line,
    end_line: c.end_line,
    snippet: (c.content || '').substring(0, 150)
  }));

  let widget;

  // 3. Execution: Multi-Agent System (Groq) or Direct Pipeline (watsonx/mock)
  if (provider === 'groq' && process.env.GROQ_API_KEY) {
    widget = await orchestrateAgents({
      query,
      chunks,
      onThought
    });
  } else {
    // watsonx or local mock fallback
    const prompt = buildRAGPrompt({
      query,
      chunks,
      conversationHistory
    });

    const { generatedText, metadata } = await generateText({ prompt });
    widget = parseAndValidateWidgetJSON(generatedText, {
      citations: fallbackCitations
    });

    widget._agent = 'watsonx-direct';
    widget._meta = metadata;
  }

  // Guarantee citations if widget is chat_response and citations are missing
  if (widget.type === 'chat_response' && (!widget.citations || widget.citations.length === 0)) {
    widget.citations = fallbackCitations;
  }

  // Attach session/execution telemetry
  widget._meta = {
    ...(widget._meta || {}),
    sessionId: sessionId || null,
    repoId: repoId || null,
    chunksRetrieved: chunks.length,
    provider: provider,
    timestamp: new Date().toISOString()
  };

  return widget;
}

module.exports = {
  executeRAGQuery
};
