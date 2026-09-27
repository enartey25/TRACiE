const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');
const { scopeSessionId } = require('../middleware/requireUser');
const { errorWidget } = require('./query');

/**
 * Helper to handle SSE streaming logic for both GET and POST requests.
 * Events: status, agent_thought, agent_handoff, complete (widget), done, error (alert_card).
 */
async function handleStream(req, res) {
  const params = req.method === 'GET' ? req.query : (req.body || {});
  const { query, repoId, repoName, sessionId } = params;
  const requestedWidget = params.requestedWidget || params.widgetType;

  if (!query || typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Query parameter is required' });
    return;
  }

  let scopedSessionId;
  try {
    scopedSessionId = await scopeSessionId(req, sessionId);
  } catch (error) {
    res.status(404).json({ error: error.message });
    return;
  }

  // Set SSE response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let isClientConnected = true;
  res.on('close', () => {
    isClientConnected = false;
  });

  try {
    sendEvent('status', { stage: 'retrieving', message: 'Searching the codebase...' });

    // Execute the multi-agent query pipeline with real-time thought streaming
    const widget = await executeRAGQuery({
      query: query.trim(),
      repoId,
      repoName,
      sessionId: scopedSessionId,
      userId: req.user.id,
      requestedWidget,
      onThought: (thought) => {
        if (!isClientConnected) return;
        const eventName = thought.action === 'subagent_handoff' ? 'agent_handoff' : 'agent_thought';
        sendEvent(eventName, thought);
      }
    });

    if (!isClientConnected) return;

    sendEvent('status', { stage: 'delivering', message: 'Rendering the answer...' });

    // Send final complete payload containing full widget object immediately
    sendEvent('complete', widget);
    sendEvent('done', { status: 'success' });
    res.end();
  } catch (error) {
    if (isClientConnected) {
      const { status, body } = errorWidget(error, 'Streaming Error');
      if (status === 500) console.error('Error streaming RAG query:', error);
      sendEvent('error', body);
      res.end();
    }
  }
}

router.get('/stream', handleStream);
router.post('/stream', handleStream);

module.exports = router;
