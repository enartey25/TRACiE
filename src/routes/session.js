const express = require('express');
const router = express.Router();
const { getSessionHistory, clearSession } = require('../services/memory/sessionMemory');
const sessionStore = require('../services/sessions/sessionStore');

/**
 * GET /api/sessions/:id/history
 * Returns the conversation history for a given session.
 * Checks active in-memory turns first; falls back to persistent Postgres queries.
 */
router.get('/sessions/:id/history', async (req, res) => {
  const sessionId = req.params.id;
  const memHistory = getSessionHistory(sessionId, 20);

  if (memHistory.length > 0) {
    return res.json({
      sessionId,
      turnsCount: memHistory.length,
      history: memHistory
    });
  }

  // If not in memory and id is a valid UUID, query PostgreSQL
  if (sessionStore.isUuid(sessionId)) {
    try {
      const queries = await sessionStore.listQueries(sessionId, 20);
      if (queries && queries.length > 0) {
        const history = queries.map(q => ({
          turnId: q.id,
          userQuery: q.raw_text,
          assistantSummary: q.llm_response?.content?.substring(0, 300) || q.llm_response?.title || 'Response',
          widgetType: q.llm_response?.type || 'chat_response',
          timestamp: q.created_at
        }));
        return res.json({
          sessionId,
          turnsCount: history.length,
          history
        });
      }
    } catch (err) {
      console.warn('[session] Could not load queries from Postgres:', err.message);
    }
  }

  res.json({
    sessionId,
    turnsCount: 0,
    history: []
  });
});

/**
 * DELETE /api/sessions/:id
 * Clears active session history.
 */
router.delete('/sessions/:id', (req, res) => {
  const sessionId = req.params.id;
  clearSession(sessionId);
  res.json({
    status: 'ok',
    message: `Session ${sessionId} cleared successfully.`
  });
});

module.exports = router;
