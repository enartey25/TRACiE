const { query } = require('../../db/postgres');

/**
 * Persistence for chat sessions and the questions/answers inside them.
 *
 * Ethan: the chat logic stays in services/rag/pipeline.js. Call these plain
 * functions from there; the simplest hook is logTurn() right after the widget
 * is produced (it never throws, so it can't break a chat response):
 *
 *   const { logTurn } = require('../sessions/sessionStore');
 *   await logTurn({ sessionId, query, chunks, widget });
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = value => typeof value === 'string' && UUID_RE.test(value);

async function createSession({ repositoryId, userAgent }) {
  const { rows } = await query(
    `INSERT INTO sessions (repository_id, user_agent) VALUES ($1, $2) RETURNING *`,
    [repositoryId, userAgent || null]
  );
  return rows[0];
}

async function getSession(id) {
  if (!isUuid(id)) return null;
  const { rows } = await query('SELECT * FROM sessions WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listSessions(repositoryId, limit = 50) {
  const { rows } = await query(
    `SELECT s.*, (SELECT count(*)::int FROM queries q WHERE q.session_id = s.id) AS query_count
     FROM sessions s WHERE s.repository_id = $1 ORDER BY s.last_active DESC LIMIT $2`,
    [repositoryId, limit]
  );
  return rows;
}

async function touchSession(id) {
  await query('UPDATE sessions SET last_active = now() WHERE id = $1', [id]);
}

/**
 * Insert one question/answer.
 * @param {object} p
 * @param {string} p.sessionId - sessions.id (UUID)
 * @param {string} p.rawText - the user's question
 * @param {string[]} [p.retrievedChunkIds] - ChromaDB chunk ids used as context
 * @param {object} [p.llmResponse] - the widget JSON returned to the UI
 */
async function logQuery({ sessionId, rawText, retrievedChunkIds = [], llmResponse = null }) {
  const { rows } = await query(
    `INSERT INTO queries (session_id, raw_text, retrieved_chunk_ids, llm_response)
     VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING *`,
    [sessionId, rawText, JSON.stringify(retrievedChunkIds || []), llmResponse == null ? null : JSON.stringify(llmResponse)]
  );
  await touchSession(sessionId);
  return rows[0];
}

/** Attach/replace the answer on an already-logged question (e.g. when streaming finishes later). */
async function updateQueryResponse(queryId, llmResponse) {
  const { rows } = await query(
    'UPDATE queries SET llm_response = $2::jsonb WHERE id = $1 RETURNING *',
    [queryId, JSON.stringify(llmResponse)]
  );
  return rows[0] || null;
}

async function listQueries(sessionId, limit = 100) {
  const { rows } = await query(
    'SELECT * FROM queries WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2',
    [sessionId, limit]
  );
  return rows;
}

/**
 * Fire-and-forget helper for the RAG pipeline. No-op unless sessionId is a real
 * sessions row (Ethan's in-memory ids like "session-1" are simply skipped).
 * Never throws.
 * @param {{ sessionId, query, chunks?: Array<{chunk_id}>, widget?: object }} p
 * @returns {Promise<object|null>} the queries row, or null if not logged
 */
async function logTurn({ sessionId, query: rawText, chunks = [], widget = null }) {
  try {
    if (!isUuid(sessionId) || !rawText) return null;
    if (!(await getSession(sessionId))) return null;
    return await logQuery({
      sessionId,
      rawText,
      retrievedChunkIds: chunks.map(c => c.chunk_id).filter(Boolean),
      llmResponse: widget
    });
  } catch (error) {
    console.warn('[sessions] logTurn failed (chat unaffected):', error.message);
    return null;
  }
}

module.exports = {
  isUuid, createSession, getSession, listSessions, touchSession,
  logQuery, updateQueryResponse, listQueries, logTurn
};
