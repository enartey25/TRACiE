const express = require('express');
const router = express.Router();
const sessionStore = require('../services/sessions/sessionStore');
const repoStore = require('../services/repos/repoStore');

/**
 * Persistent chat sessions (Postgres). Route paths deliberately avoid Ethan's
 * in-memory routes GET /api/sessions/:id/history and DELETE /api/sessions/:id.
 */

const sessionView = s => ({
  sessionId: s.id,
  repositoryId: s.repository_id,
  userAgent: s.user_agent,
  startedAt: s.started_at,
  lastActive: s.last_active,
  ...(s.query_count !== undefined ? { queryCount: s.query_count } : {})
});

const queryView = q => ({
  queryId: q.id,
  sessionId: q.session_id,
  rawText: q.raw_text,
  retrievedChunkIds: q.retrieved_chunk_ids,
  llmResponse: q.llm_response,
  createdAt: q.created_at
});

/** POST /api/sessions  { repositoryId } -> 201 Session */
router.post('/sessions', async (req, res) => {
  const { repositoryId } = req.body || {};
  if (!sessionStore.isUuid(repositoryId)) {
    return res.status(400).json({ error: 'Field "repositoryId" must be a repository UUID from /api/repos.' });
  }
  try {
    if (!(await repoStore.getRepository(repositoryId))) {
      return res.status(404).json({ error: 'Repository not found.' });
    }
    const session = await sessionStore.createSession({ repositoryId, userAgent: req.get('User-Agent') });
    res.status(201).json(sessionView(session));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/sessions/:id -> Session + its queries (oldest first) */
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await sessionStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const queries = await sessionStore.listQueries(session.id);
    res.json({ ...sessionView(session), queries: queries.map(queryView) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sessions/:id/queries
 * { rawText, retrievedChunkIds?: string[], llmResponse?: object } -> 201 Query
 */
router.post('/sessions/:id/queries', async (req, res) => {
  const { rawText, retrievedChunkIds, llmResponse } = req.body || {};
  if (!rawText || typeof rawText !== 'string') {
    return res.status(400).json({ error: 'Field "rawText" is required.' });
  }
  if (retrievedChunkIds !== undefined && !Array.isArray(retrievedChunkIds)) {
    return res.status(400).json({ error: 'Field "retrievedChunkIds" must be an array of chunk ids.' });
  }
  try {
    const session = await sessionStore.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found.' });
    const row = await sessionStore.logQuery({ sessionId: session.id, rawText, retrievedChunkIds, llmResponse });
    res.status(201).json(queryView(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** PATCH /api/queries/:id  { llmResponse } -> Query  (attach the answer after streaming completes) */
router.patch('/queries/:id', async (req, res) => {
  const { llmResponse } = req.body || {};
  if (!sessionStore.isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid query id.' });
  if (llmResponse === undefined) return res.status(400).json({ error: 'Field "llmResponse" is required.' });
  try {
    const row = await sessionStore.updateQueryResponse(req.params.id, llmResponse);
    if (!row) return res.status(404).json({ error: 'Query not found.' });
    res.json(queryView(row));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/repos/:id/sessions -> { sessions: [Session + queryCount] } most recent first */
router.get('/repos/:id/sessions', async (req, res) => {
  if (!sessionStore.isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid repository id.' });
  try {
    const sessions = await sessionStore.listSessions(req.params.id);
    res.json({ sessions: sessions.map(sessionView) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
