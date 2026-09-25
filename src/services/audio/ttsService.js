const axios = require('axios');

/**
 * TRACiE Audio Briefing / Text-to-Speech (TTS) Service
 * Supports:
 * 1. ElevenLabs (Ultra-realistic, studio-grade AI voice)
 * 2. IBM Watson Text-to-Speech (/v1/synthesize)
 * 3. Browser-native Web Speech API (zero-dependency fallback)
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default: Rachel (clear professional voice)

const WATSON_TTS_APIKEY = process.env.WATSON_TTS_APIKEY || '';
const WATSON_TTS_URL = process.env.WATSON_TTS_URL || 'https://api.us-south.text-to-speech.watson.cloud.ibm.com';

/**
 * Checks if ElevenLabs credentials are configured.
 */
function hasElevenLabs() {
  return Boolean(
    ELEVENLABS_API_KEY &&
    ELEVENLABS_API_KEY !== 'your_elevenlabs_api_key_here'
  );
}

/**
 * Checks if IBM Watson TTS credentials are configured.
 */
function hasWatsonTTS() {
  return Boolean(
    WATSON_TTS_APIKEY &&
    WATSON_TTS_APIKEY !== 'your_watson_tts_apikey'
  );
}

/**
 * Synthesizes speech using ElevenLabs API and returns a base64 MP3 data URI.
 */
async function synthesizeWithElevenLabs(text, voiceId = ELEVENLABS_VOICE_ID) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await axios.post(
    url,
    {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75
      }
    },
    {
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 15000
    }
  );

  const base64Audio = Buffer.from(response.data, 'binary').toString('base64');
  return `data:audio/mp3;base64,${base64Audio}`;
}

/**
 * Synthesizes an audio briefing from a textual explanation.
 *
 * @param {object} params
 * @param {string} params.title - Briefing title.
 * @param {string} params.text - Natural language explanation script.
 * @returns {Promise<object>} - Valid audio_player widget payload.
 */
async function synthesizeBriefing({ title = 'Codebase Audio Briefing', text = '' }) {
  if (!text) {
    throw new Error('Text parameter is required for audio synthesis.');
  }

  // Calculate approximate duration (~140 words per minute)
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = Number(((wordCount / 140) * 60).toFixed(1));

  // 1. ElevenLabs (Studio-Grade Hyper-Realistic Voice)
  if (hasElevenLabs()) {
    try {
      const audioUrl = await synthesizeWithElevenLabs(text);
      return {
        type: 'audio_player',
        title,
        transcript: text,
        audio_url: audioUrl,
        duration_seconds: durationSeconds,
        provider: 'ElevenLabs Studio Voice'
      };
    } catch (err) {
      console.warn('ElevenLabs synthesis failed, falling back to next provider:', err.message);
    }
  }

  // 2. IBM Watson TTS (Enterprise Cloud Fallback)
  if (hasWatsonTTS()) {
    try {
      const response = await axios.post(
        `${WATSON_TTS_URL}/v1/synthesize?voice=en-US_AllisonV3Voice`,
        { text },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/mp3',
            'Authorization': 'Basic ' + Buffer.from(`apikey:${WATSON_TTS_APIKEY}`).toString('base64')
          },
          responseType: 'arraybuffer',
          timeout: 10000
        }
      );

      const base64Audio = Buffer.from(response.data, 'binary').toString('base64');
      return {
        type: 'audio_player',
        title,
        transcript: text,
        audio_url: `data:audio/mp3;base64,${base64Audio}`,
        duration_seconds: durationSeconds,
        provider: 'IBM Watson Text-to-Speech'
      };
    } catch (err) {
      console.warn('IBM Watson TTS call failed, falling back to Web Speech:', err.message);
    }
  }

  // 3. Browser-Native Web Speech API / Zero-Dependency Fallback
  return {
    type: 'audio_player',
    title,
    transcript: text,
    audio_url: '',
    duration_seconds: durationSeconds,
    provider: 'Web Speech API / Native Synthesizer'
  };
}

module.exports = {
  synthesizeBriefing,
  hasElevenLabs,
  hasWatsonTTS
};
