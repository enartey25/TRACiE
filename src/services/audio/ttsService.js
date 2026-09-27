require('dotenv').config();
const axios = require('axios');

/**
 * TRACiE Audio Briefing / Text-to-Speech (TTS) Service
 * Direct Two-Tier Architecture:
 * 1. ElevenLabs (Ultra-realistic, studio-grade AI voice)
 * 2. Browser-native Web Speech API (zero-dependency client-side fallback)
 */

function getApiKey() {
  // Keys never contain whitespace; keep only the first token so stray pasted
  // text or inline notes after the key don't cause a 401 "invalid_api_key".
  return (process.env.ELEVENLABS_API_KEY || '').trim().split(/\s+/)[0].replace(/^["']|["']$/g, '');
}

function getVoiceId() {
  return process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default: Adam (deep, natural, realistic tech narrator)
}

/**
 * Checks if ElevenLabs credentials are configured.
 */
function hasElevenLabs() {
  const key = getApiKey();
  return Boolean(
    key &&
    key !== 'your_elevenlabs_api_key_here' &&
    key.length > 10
  );
}

/**
 * Synthesizes speech using ElevenLabs API and returns a base64 MP3 data URI and raw base64.
 */
async function synthesizeWithElevenLabs(text, voiceId = null) {
  const chosenVoiceId = voiceId || getVoiceId();
  const apiKey = getApiKey();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${chosenVoiceId}`;

  const response = await axios.post(
    url,
    {
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.05
      }
    },
    {
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 20000
    }
  );

  const base64Audio = Buffer.from(response.data).toString('base64');
  const audioUrl = `data:audio/mp3;base64,${base64Audio}`;
  return { audioUrl, base64Audio };
}

/**
 * Synthesizes an audio briefing from a textual explanation.
 * Attempts ElevenLabs first. If unavailable, falls back directly to Browser Web Speech API.
 *
 * @param {object} params
 * @param {string} params.title - Briefing title.
 * @param {string} params.text - Natural language explanation script.
 * @param {string} [params.voiceId] - Optional voice ID override.
 * @returns {Promise<object>} - Valid audio_player widget payload.
 */
async function synthesizeBriefing({ title = 'Codebase Audio Briefing', text = '', voiceId = null }) {
  if (!text) {
    throw new Error('Text parameter is required for audio synthesis.');
  }

  // Calculate approximate duration (~140 words per minute)
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = Number(((wordCount / 140) * 60).toFixed(1));

  // 1. Live ElevenLabs (Studio-Grade Hyper-Realistic Voice)
  if (hasElevenLabs()) {
    try {
      const { audioUrl, base64Audio } = await synthesizeWithElevenLabs(text, voiceId);
      return {
        type: 'audio_player',
        title,
        transcript: text,
        audio_url: audioUrl,
        audio: base64Audio,
        mimeType: 'audio/mp3',
        duration_seconds: durationSeconds,
        provider: 'ElevenLabs Studio Voice'
      };
    } catch (err) {
      const status = err.response?.status;
      let detail = err.message;
      if (err.response?.data) {
        try {
          detail = Buffer.from(err.response.data).toString('utf-8');
        } catch (_) {
          detail = String(err.response.data);
        }
      }
      console.warn(`[tts] ElevenLabs live synthesis failed (HTTP ${status || 'network'} - ${err.message}): ${detail}. Falling back to Browser Web Speech.`);
    }
  }

  // 2. Direct Fallback: Browser-Native Web Speech API / Client-Side Synthesizer
  return {
    type: 'audio_player',
    title,
    transcript: text,
    audio_url: '',
    audio: null,
    mimeType: null,
    duration_seconds: durationSeconds,
    provider: 'Web Speech API / Native Synthesizer'
  };
}

module.exports = {
  synthesizeBriefing,
  synthesizeWithElevenLabs,
  hasElevenLabs,
  getApiKey,
  getVoiceId
};
