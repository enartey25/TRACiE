const express = require('express');
const router = express.Router();
const { getSessionHistory, clearSession } = require('../services/memory/sessionMemory');

/**
 * GET /api/sessions/:id/history
 * Returns the conversation history for a given session.
 */
router.get('/sessions/:id/history', (req, res) => {
  const sessionId = req.params.id;
  const history = getSessionHistory(sessionId, 20);
  res.json({
    sessionId,
    turnsCount: history.length,
    history
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
