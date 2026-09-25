const { Groq } = require('groq-sdk');
require('dotenv').config();

let groqInstance = null;

function getGroqClient() {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in environment variables.');
    }
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

/**
 * Generates text / JSON completion using Groq LPU engine.
 * @param {object} params
 * @param {string} params.prompt - User query or prompt.
 * @param {string} [params.systemPrompt] - System instructions.
 * @param {string} [params.model] - Target model.
 * @param {boolean} [params.jsonMode=true] - Force valid JSON mode.
 * @returns {Promise<{ generatedText: string, metadata: object }>}
 */
async function generateGroqCompletion({ prompt, systemPrompt, model, jsonMode = true }) {
  const client = getGroqClient();
  const targetModel = model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const options = {
    model: targetModel,
    messages,
    temperature: 0.2
  };

  if (jsonMode) {
    options.response_format = { type: 'json_object' };
  }

  const startTime = Date.now();
  const completion = await client.chat.completions.create(options);
  const durationMs = Date.now() - startTime;

  const choice = completion.choices[0];
  const content = choice?.message?.content || '{}';
  const usage = completion.usage || {};

  // Bobcoin simulation metric: 1 Bobcoin ~ 10,000 computation tokens
  const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  const bobcoinsConsumed = Number((totalTokens / 10000).toFixed(4));

  return {
    generatedText: content,
    metadata: {
      provider: 'groq-lpu',
      modelId: targetModel,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens,
      latencyMs: durationMs,
      bobcoinsConsumed
    }
  };
}

module.exports = {
  getGroqClient,
  generateGroqCompletion
};
