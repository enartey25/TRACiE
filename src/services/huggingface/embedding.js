const axios = require('axios');

/**
 * TRACiE Hugging Face Embeddings
 * Real semantic embeddings via the HF Inference router's feature-extraction
 * pipeline. Used as the fallback provider when IBM watsonx.ai credentials
 * are not configured, so ingestion/RAG still get vectors that actually
 * reflect text similarity (unlike the deterministic mock).
 *
 * Throughput notes (this is a shared free-tier API, latency-bound not
 * compute-bound): requests are batched and a bounded number run concurrently
 * to cut wall-clock time on large repos, while staying modest enough not to
 * trip the free tier's rate limits. Transient 503/429s (cold model, brief
 * backend hiccups) are retried with backoff instead of failing the batch.
 */

const HF_ROUTER_URL = 'https://router.huggingface.co/hf-inference/models';
const DEFAULT_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSIONS = 384; // all-MiniLM-L6-v2 output size
const DEFAULT_BATCH_SIZE = 32;   // texts per HTTP request
const DEFAULT_CONCURRENCY = 4;   // requests in flight at once
const MAX_ATTEMPTS = 4;

function getToken() {
  return process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || '';
}

function hasHFCredentials() {
  return Boolean(getToken());
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Runs `fn` over `items` with at most `limit` calls in flight at once. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

/** POST to the feature-extraction pipeline; retries transient failures with backoff. */
async function callFeatureExtraction(inputs, { modelId, timeout = 30000 } = {}) {
  const token = getToken();
  if (!token) throw new Error('HF_TOKEN is missing in .env. Please add your free Hugging Face token.');

  const model = modelId || process.env.HF_EMBEDDING_MODEL || DEFAULT_MODEL;
  const url = `${HF_ROUTER_URL}/${model}/pipeline/feature-extraction`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await axios.post(url, { inputs, options: { wait_for_model: true } }, { headers, timeout });
      return response.data;
    } catch (error) {
      const status = error.response && error.response.status;
      const retryAfterHeader = error.response && error.response.headers && error.response.headers['retry-after'];
      // Retryable: 503 (cold model / brief backend hiccup), 429 (rate limit), and transient network errors.
      const retryable = status === 503 || status === 429 || !status;
      if (retryable && attempt < MAX_ATTEMPTS) {
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : 0;
        const backoffMs = retryAfterMs || Math.min(1000 * 2 ** (attempt - 1), 8000);
        await sleep(backoffMs);
        continue;
      }
      const details = error.response ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`HuggingFace embedding failed: ${details}`);
    }
  }
}

/**
 * Generates a vector embedding for a single text string via HuggingFace.
 * @returns {Promise<number[]>}
 */
async function generateHFEmbedding(text, options = {}) {
  const [vector] = await callFeatureExtraction([text], options);
  return vector;
}

/**
 * Generates vector embeddings for a list of texts: split into batches,
 * sent with bounded concurrency, and reassembled in the original order.
 * @returns {Promise<number[][]>} same order, same length as `texts`
 */
async function generateHFEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const concurrency = options.concurrency || DEFAULT_CONCURRENCY;

  const batches = [];
  for (let i = 0; i < texts.length; i += batchSize) batches.push(texts.slice(i, i + batchSize));

  const batchResults = await mapWithConcurrency(batches, concurrency, batch => callFeatureExtraction(batch, options));
  return batchResults.flat();
}

module.exports = {
  generateHFEmbedding,
  generateHFEmbeddings,
  hasHFCredentials,
  EMBEDDING_DIMENSIONS,
  DEFAULT_MODEL,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONCURRENCY
};
