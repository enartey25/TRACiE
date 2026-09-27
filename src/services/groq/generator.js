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
  // Prompt builders put retrieved context first and end with "USER QUERY: ...". Truncating
  // from the front (old behaviour) can cut the query itself off entirely, leaving the model
  // with only context and no question to answer. Keep the tail instead so the query always survives.
  const trimmedPrompt = (prompt && prompt.length > 9000)
    ? ('[Earlier context truncated to adhere to TPM rate limits]\n\n' + prompt.slice(-9000))
    : prompt;
  messages.push({ role: 'user', content: trimmedPrompt });

  const options = {
    model: targetModel,
    messages,
    temperature: 0.2,
    max_tokens: 2048
  };

  if (jsonMode) {
    options.response_format = { type: 'json_object' };
  }

  const startTime = Date.now();
  let completion;
  try {
    completion = await client.chat.completions.create(options);
  } catch (err) {
    if (err.status === 429 || (err.message && err.message.includes('Rate limit')) || err.status === 413) {
      const waitMs = 1000;
      console.warn(`[Groq] Rate limit hit on ${targetModel}. Retrying in ${waitMs}ms...`);
      await new Promise(r => setTimeout(r, waitMs));
      try {
        completion = await client.chat.completions.create(options);
      } catch (retryErr) {
        try {
          console.warn(`[Groq] Trying available model 'qwen/qwen3.8-27b'...`);
          completion = await client.chat.completions.create({ ...options, model: 'qwen/qwen3.8-27b' });
        } catch (qwenErr) {
          if (targetModel !== 'openai/gpt-oss-20b') {
            console.warn(`[Groq] Trying available model 'openai/gpt-oss-20b'...`);
            completion = await client.chat.completions.create({ ...options, model: 'openai/gpt-oss-20b' });
          } else {
            throw retryErr;
          }
        }
      }
    } else if (err.message && err.message.includes('json_validate_failed')) {
      console.warn(`[Groq] json_validate_failed on ${targetModel}: retrying once at temperature 0 (still JSON mode)...`);
      try {
        completion = await client.chat.completions.create({ ...options, temperature: 0 });
      } catch (retryErr) {
        // Dropping response_format is a last resort: without it the model isn't constrained
        // to JSON at all, so its output is more likely to be unusable free text.
        console.warn(`[Groq] retry also failed json validation: falling back without strict json_object constraint...`);
        const fallbackOptions = { ...options };
        delete fallbackOptions.response_format;
        completion = await client.chat.completions.create(fallbackOptions);
      }
    } else {
      throw err;
    }
  }
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
