const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');

/**
 * POST /api/query
 * Accepts user query and returns structured widget JSON.
 * Request Body:
 * {
 *   "query": "string (required)",
 *   "repoId": "string (optional)",
 *   "sessionId": "string (optional)",
 *   "conversationHistory": "array (optional)"
 * }
 */
router.post('/query', async (req, res) => {
  const { query, repoId, sessionId, conversationHistory } = req.body || {};

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({
      type: 'alert_card',
      severity: 'error',
      title: 'Bad Request',
      message: 'Field "query" is required and must be a non-empty string.'
    });
  }

  try {
    const widget = await executeRAGQuery({
      query: query.trim(),
      repoId,
      sessionId,
      conversationHistory
    });

    return res.status(200).json(widget);
  } catch (error) {
    console.error('Error executing RAG query:', error);
    return res.status(500).json({
      type: 'alert_card',
      severity: 'error',
      title: 'RAG Pipeline Error',
      message: error.message || 'An unexpected error occurred while processing your request.'
    });
  }
});

module.exports = router;
