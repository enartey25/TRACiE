const express = require('express');
const router = express.Router();
const { synthesizeBriefing } = require('../services/audio/ttsService');

/**
 * POST /api/audio/synthesize
 * Accepts text explanation and returns an audio_player widget.
 */
router.post('/audio/synthesize', async (req, res) => {
  const { title, text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      type: 'alert_card',
      severity: 'error',
      title: 'Bad Request',
      message: 'Field "text" is required for audio synthesis.'
    });
  }

  try {
    const widget = await synthesizeBriefing({
      title: title || 'Codebase Audio Briefing',
      text: text.trim()
    });
    res.status(200).json(widget);
  } catch (error) {
    console.error('Audio synthesis failed:', error);
    res.status(500).json({
      type: 'alert_card',
      severity: 'error',
      title: 'Audio Synthesis Error',
      message: error.message
    });
  }
});

module.exports = router;
