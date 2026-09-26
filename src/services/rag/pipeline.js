const { generateEmbedding } = require('../watsonx/embedding');
const { generateText } = require('../watsonx/generator');
const { retrieveCodeChunks } = require('./retriever');
const { buildRAGPrompt } = require('../../prompts/promptTemplates');
const { parseAndValidateWidgetJSON } = require('./jsonParser');
const { orchestrateAgents } = require('../agents/supervisor');
const { recordTurn, getFormattedHistoryForPrompt } = require('../memory/sessionMemory');
const { detectExternalReferences, formatExternalReferencesForPrompt } = require('../enrichment/contextEnricher');

/**
 * Executes the complete RAG Query Pipeline for developer queries.
 * Integrates:
 * 1. Semantic vector retrieval (ChromaDB)
 * 2. Multi-turn session memory (sessionMemory)
 * 3. External documentation enrichment (MDN, npm, RFC standards)
 * 4. IBM BeeAI multi-agent orchestration
 *
 * @param {object} params
 * @param {string} params.query - Developer natural language question.
 * @param {string} [params.repoId] - Target repository identifier.
 * @param {string} [params.sessionId] - Conversation session identifier.
 * @param {Array<object>} [params.conversationHistory] - Explicit prior turns (optional).
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
    query,
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

  // 3. Multi-Turn Session Memory Lookup
  const sessionHistoryText = sessionId
    ? getFormattedHistoryForPrompt(sessionId, 4)
    : (conversationHistory.length > 0 ? JSON.stringify(conversationHistory) : '');

  // 4. External Documentation & Standards Enrichment (FR-33, FR-34)
  const externalRefs = detectExternalReferences({ chunks, query, maxReferences: 3 });
  const externalContextText = formatExternalReferencesForPrompt(externalRefs);

  let widget;

  // 5. Execution: Multi-Agent System (Groq) or Direct Pipeline (watsonx/mock)
  if (provider === 'groq' && process.env.GROQ_API_KEY) {
    widget = await orchestrateAgents({
      query,
      chunks,
      conversationHistory: sessionHistoryText,
      externalContext: externalContextText,
      onThought
    });
  } else {
    // watsonx or local mock fallback
    const prompt = buildRAGPrompt({
      query,
      chunks,
      conversationHistory,
      externalContext: externalContextText
    });

    const { generatedText, metadata } = await generateText({ prompt });
    widget = parseAndValidateWidgetJSON(generatedText, {
      citations: fallbackCitations
    });

    widget._agent = 'watsonx-direct';
    widget._meta = metadata;
  }

  // Guarantee citations if widget is chat_response and citations are missing
  if (widget.type === 'chat_response') {
    if (!widget.citations || widget.citations.length === 0) {
      widget.citations = fallbackCitations;
    }
    if (!widget.external_references || widget.external_references.length === 0) {
      widget.external_references = externalRefs;
    }
  }

  // 6. Record turn in multi-turn memory
  if (sessionId) {
    recordTurn(sessionId, { query, widget });
  }

  // Attach session/execution telemetry
  widget._meta = {
    ...(widget._meta || {}),
    sessionId: sessionId || null,
    repoId: repoId || null,
    chunksRetrieved: chunks.length,
    externalRefsMatched: externalRefs.length,
    provider: provider,
    timestamp: new Date().toISOString()
  };

  return widget;
}

module.exports = {
  executeRAGQuery
};
