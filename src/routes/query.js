const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');
const { scopeSessionId } = require('../middleware/requireUser');

/**
 * Maps pipeline errors to an alert_card widget + HTTP status. Shared with routes/stream.js.
 * @returns {{ status: number, body: object }}
 */
function errorWidget(error, fallbackTitle) {
  if (error.code === 'REPO_NOT_READY') {
    return {
      status: 409,
      body: {
        type: 'alert_card',
        severity: 'warning',
        title: 'Repository Not Ready',
        message: error.message,
        repositoryId: error.repositoryId,
        indexStatus: error.indexStatus
      }
    };
  }
  if (error.code === 'REPO_NOT_FOUND' || error.status === 404) {
    return { status: 404, body: { type: 'alert_card', severity: 'warning', title: 'Not Found', message: error.message } };
  }
  return {
    status: 500,
    body: {
      type: 'alert_card',
      severity: 'error',
      title: fallbackTitle,
      message: error.message || 'An unexpected error occurred while processing your request.'
    }
  };
}

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
  const { query, repoId, repoName, sessionId, conversationHistory, requestedWidget, widgetType } = req.body || {};

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
      repoName,
      sessionId: await scopeSessionId(req, sessionId),
      userId: req.user.id,
      conversationHistory,
      requestedWidget: requestedWidget || widgetType
    });

    return res.status(200).json(widget);
  } catch (error) {
    const { status, body } = errorWidget(error, 'RAG Pipeline Error');
    if (status === 500) console.error('Error executing RAG query:', error);
    return res.status(status).json(body);
  }
});

module.exports = router;
module.exports.errorWidget = errorWidget;
