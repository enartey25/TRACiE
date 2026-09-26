const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');

/**
 * Helper to handle SSE streaming logic for both GET and POST requests.
 */
async function handleStream(req, res) {
  const query = req.method === 'GET' ? req.query.query : req.body?.query;
  const repoId = req.method === 'GET' ? req.query.repoId : req.body?.repoId;
  const sessionId = req.method === 'GET' ? req.query.sessionId : req.body?.sessionId;

  if (!query || typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: 'Query parameter is required' });
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
  req.on('close', () => {
    isClientConnected = false;
  });

  try {
    sendEvent('status', { stage: 'retrieving', message: 'Analyzing codebase and vector store...' });

    // Execute the multi-agent query pipeline with real-time thought streaming
    const widget = await executeRAGQuery({
      query: query.trim(),
      repoId,
      sessionId,
      onThought: (thought) => {
        if (!isClientConnected) return;
        const eventName = thought.action === 'subagent_handoff' ? 'agent_handoff' : 'agent_thought';
        sendEvent(eventName, thought);
      }
    });

    if (!isClientConnected) return;

    if (!isClientConnected) return;

    sendEvent('status', { stage: 'delivering', message: 'Rendering dynamic widget...' });

    // Send final complete payload containing full widget object immediately
    sendEvent('complete', widget);
    sendEvent('done', { status: 'success' });
    res.end();
  } catch (error) {
    if (isClientConnected) {
      sendEvent('error', {
        type: 'alert_card',
        severity: 'error',
        title: 'Streaming Error',
        message: error.message
      });
      res.end();
    }
  }
}

router.get('/stream', handleStream);
router.post('/stream', handleStream);

module.exports = router;
