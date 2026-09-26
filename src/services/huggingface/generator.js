const axios = require('axios');

/**
 * TRACiE Hugging Face Generator (IBM Granite Integration)
 * Calls the Hugging Face Router endpoint for IBM Granite 3.0:
 * Model: ibm-granite/granite-3.0-8b-instruct
 */

const HF_ROUTER_URL = 'https://router.huggingface.co/v1/chat/completions';
const DEFAULT_GRANITE_MODEL = 'ibm-granite/granite-3.0-8b-instruct';

/**
 * Generates structured completion using IBM Granite 3.0 via Hugging Face.
 *
 * @param {object} params
 * @param {string} params.prompt - Formatted prompt for the subagent.
 * @param {string} params.systemPrompt - System-level schema instructions.
 * @returns {Promise<{ generatedText: string, metadata: object }>}
 */
async function generateHuggingFaceCompletion({ prompt, systemPrompt }) {
  const token = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  if (!token) {
    throw new Error('HF_TOKEN is missing in .env. Please add your free Hugging Face token.');
  }

  const model = process.env.HF_GRANITE_MODEL || DEFAULT_GRANITE_MODEL;
  const startTime = Date.now();

  const response = await axios.post(
    HF_ROUTER_URL,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 3000
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  const durationMs = Date.now() - startTime;
  const choice = response.data?.choices?.[0];
  const generatedText = choice?.message?.content || '';

  return {
    generatedText,
    metadata: {
      provider: 'Hugging Face (IBM Granite 3.0)',
      model,
      durationMs,
      bobcoinsConsumed: 0.05
    }
  };
}

module.exports = {
  generateHuggingFaceCompletion,
  DEFAULT_GRANITE_MODEL
};
