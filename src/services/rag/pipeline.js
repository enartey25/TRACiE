const { generateEmbedding } = require('../watsonx/embedding');
const { generateText } = require('../watsonx/generator');
const { retrieveCodeChunks } = require('./retriever');
const { buildRAGPrompt } = require('../../prompts/promptTemplates');
const { parseAndValidateWidgetJSON } = require('./jsonParser');
const { orchestrateAgents } = require('../agents/supervisor');
const { recordTurn, getFormattedHistoryForPrompt, getSessionHistory } = require('../memory/sessionMemory');
const { logTurn } = require('../sessions/sessionStore');
const { detectExternalReferences, formatExternalReferencesForPrompt } = require('../enrichment/contextEnricher');
const repoStore = require('../repos/repoStore');
const {
  isFollowUpQuery,
  getCachedResponse,
  setCachedResponse,
  getCachedChunks,
  setCachedChunks,
  setSessionChunks,
  getSessionChunks
} = require('./ragCache');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
async function executeRAGQuery({ query, repoId, repoName, sessionId, conversationHistory = [], requestedWidget, onThought }) {
  if (!query || typeof query !== 'string') {
    throw new Error('Query must be a non-empty string.');
  }

  const startTime = Date.now();
  const provider = (process.env.LLM_PROVIDER || 'groq').toLowerCase();

  // -- Step -1: Resolve Target Repository ------------------------------------
  let effectiveRepoId = repoId;
  let targetRepoName = repoName || 'the repository';
  const qLower = query.toLowerCase();

  // 1. If explicit UUID repoId was provided, look up repository metadata
  if (effectiveRepoId && UUID_RE.test(effectiveRepoId) && effectiveRepoId !== 'TRACiE') {
    try {
      const repo = await repoStore.getRepository(effectiveRepoId);
      if (repo) {
        targetRepoName = repo.name || targetRepoName;
      }
    } catch {}
  } else {
    // 2. No UUID repoId provided: inspect connected repositories in DB
    try {
      const repos = await repoStore.listRepositories();
      if (repos && repos.length > 0) {
        // Check if query explicitly matches any connected repository name
        const matched = repos.find(r => r.name && qLower.includes(r.name.split('/')[1]?.toLowerCase() || r.name.toLowerCase()));
        if (matched) {
          effectiveRepoId = matched.id;
          targetRepoName = matched.name;
        } else if (!qLower.includes('tracie')) {
          // If query does not explicitly ask for TRACiE, default to the user's connected repository
          effectiveRepoId = repos[0].id;
          targetRepoName = repos[0].name;
        } else {
          targetRepoName = 'TRACiE';
        }
      } else if (qLower.includes('fastapi')) {
        targetRepoName = 'FastAPI';
      } else {
        targetRepoName = 'TRACiE';
      }
    } catch {
      targetRepoName = 'TRACiE';
    }
  }

  const cacheKey = targetRepoName ? `${effectiveRepoId || 'repo'}::${targetRepoName}` : (effectiveRepoId || 'TRACiE');

  // Multi-turn session context check
  const sessionHistory = sessionId ? getSessionHistory(sessionId) : [];
  const hasPriorTurns = sessionHistory.length > 0;
  const lastTurn = hasPriorTurns ? sessionHistory[sessionHistory.length - 1] : null;
  const isFollowUp = Boolean(sessionId && (hasPriorTurns || isFollowUpQuery(query)));

  // If follow-up, use context-aware cache key incorporating preceding query so it never collides with generic cross-session queries
  const effectiveCacheKey = isFollowUp && lastTurn
    ? `${cacheKey}::followup::${lastTurn.userQuery}`
    : cacheKey;

  // -- Step 0: Semantic / Fast-Path Response Cache ---------------------------
  const shouldCheckCache = !isFollowUp || (isFollowUp && Boolean(lastTurn));
  const cachedWidget = shouldCheckCache ? getCachedResponse(query, effectiveCacheKey, requestedWidget) : null;
  if (cachedWidget) {
    if (onThought) {
      onThought({
        agent: 'TRACiE-Cache',
        action: 'cache_hit',
        thought: `[fast] Instant cache hit: Serving cached widget for "${query.slice(0, 50)}" (${Date.now() - startTime}ms latency).`
      });
    }
    if (sessionId) {
      recordTurn(sessionId, { query, widget: cachedWidget });
    }
    return cachedWidget;
  }

  // -- Step 1: Follow-Up Detection & Context Warmup --------------------------
  let chunks = null;
  let cacheTier = 'cold';
  const sessionData = sessionId ? getSessionChunks(sessionId) : null;

  if (isFollowUp && sessionData && sessionData.chunks && sessionData.chunks.length > 0) {
    // Re-use warm codebase chunks from prior turn in this session
    chunks = sessionData.chunks;
    cacheTier = 'session_warm_context';
    if (onThought) {
      onThought({
        agent: 'TRACiE-Memory',
        action: 'context_warmup',
        thought: `[fast] Context acceleration: Reusing ${chunks.length} warm codebase chunks from preceding session turn.`
      });
    }
  } else {
    // Retrieval query: If follow-up, combine with last turn query for high-relevance semantic search
    const retrievalQuery = isFollowUp && lastTurn ? `${lastTurn.userQuery} ${query}` : query;
    const cachedChunks = getCachedChunks(cacheKey, retrievalQuery);
    if (cachedChunks && cachedChunks.length > 0) {
      chunks = cachedChunks;
      cacheTier = 'chunks_cache';
    } else {
      // Vectorize query and retrieve top-k chunks from ChromaDB
      const queryEmbedding = await generateEmbedding(retrievalQuery);
      chunks = await retrieveCodeChunks({
        query: retrievalQuery,
        queryEmbedding,
        repoId: effectiveRepoId,
        topK: 5
      });
      setCachedChunks(cacheKey, retrievalQuery, chunks);
    }
  }

  // Update warm session chunks for subsequent follow-up queries
  if (sessionId) {
    setSessionChunks(sessionId, { chunks, query, widgetType: requestedWidget });
  }

  const fallbackCitations = (chunks || []).map(c => ({
    file_path: c.file_path || c.metadata?.url || (c.chunk_type === 'commit' || c.chunk_type === 'pull_request' ? 'git-history' : 'unknown'),
    start_line: c.start_line || 1,
    end_line: c.end_line || 1,
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
      requestedWidget,
      repoId: effectiveRepoId,
      repoName: targetRepoName,
      onThought
    });
  } else {
    // watsonx or local mock fallback
    const effectiveQuery = requestedWidget
      ? `${query}\n[CRITICAL OVERRIDE: Format output strictly as a "${requestedWidget}" widget]`
      : query;

    const prompt = buildRAGPrompt({
      query: effectiveQuery,
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

  // 6. Record turn in multi-turn memory & persist in Postgres session store
  if (sessionId) {
    recordTurn(sessionId, { query, widget });
    await logTurn({ sessionId, query, chunks, widget });
  }

  // Attach session/execution telemetry
  widget._cached = false;
  widget._cacheTier = cacheTier;
  widget._meta = {
    ...(widget._meta || {}),
    sessionId: sessionId || null,
    repoId: effectiveRepoId || null,
    repoName: targetRepoName,
    chunksRetrieved: (chunks || []).length,
    externalRefsMatched: (externalRefs || []).length,
    provider: provider,
    executionTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };

  // Cache response for instant repeat queries
  setCachedResponse(query, effectiveCacheKey, requestedWidget, widget);

  return widget;
}

module.exports = {
  executeRAGQuery
};
