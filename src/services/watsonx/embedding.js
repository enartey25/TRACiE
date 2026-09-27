const axios = require('axios');
const config = require('../../config/watsonx');
const { getAuthHeaders, hasValidCredentials } = require('./auth');
const { generateHFEmbedding, generateHFEmbeddings, hasHFCredentials } = require('../huggingface/embedding');
const { getCachedEmbedding, setCachedEmbedding } = require('../rag/ragCache');

/**
 * Provider priority for embeddings (ingestion AND query MUST use the same one,
 * otherwise retrieval silently returns garbage):
 *   1. watsonx.ai   - if WATSONX_APIKEY/WATSONX_PROJECT_ID are set
 *   2. HuggingFace  - if HF_TOKEN is set (real semantic vectors, free tier)
 * There is no mock/deterministic fallback: with neither configured, embedding
 * calls fail loudly instead of silently storing/querying meaningless vectors.
 * @returns {'watsonx'|'huggingface'}
 */
function getEmbeddingMode() {
  if (hasValidCredentials()) return 'watsonx';
  if (hasHFCredentials()) return 'huggingface';
  return null;
}

function requireProvider() {
  const mode = getEmbeddingMode();
  if (!mode) {
    throw new Error(
      'No embedding provider configured. Set WATSONX_APIKEY + WATSONX_PROJECT_ID, or HF_TOKEN, in .env.'
    );
  }
  return mode;
}

/**
 * Generates a vector embedding for a single text string.
 * @param {string} text - The input text to embed.
 * @param {object} [options] - Optional overrides (modelId, projectId).
 * @returns {Promise<number[]>} - Dense vector of floating point numbers.
 */
async function generateEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text must be a non-empty string.');
  }

  // Fast-path cache lookup
  const cached = getCachedEmbedding(text);
  if (cached) return cached;

  const mode = requireProvider();

  if (mode === 'huggingface') {
    const vector = await generateHFEmbedding(text, options);
    setCachedEmbedding(text, vector);
    return vector;
  }

  const headers = await getAuthHeaders();
  const url = `${config.url}/ml/v1/text/embeddings?version=${config.apiVersion}`;
  const modelId = options.modelId || config.embeddingModelId;
  const projectId = options.projectId || config.projectId;

  try {
    const response = await axios.post(
      url,
      {
        inputs: [text],
        model_id: modelId,
        project_id: projectId,
        parameters: { truncate_input_tokens: 512 }
      },
      { headers, timeout: 15000 }
    );

    if (
      response.data &&
      response.data.results &&
      response.data.results[0] &&
      response.data.results[0].embedding
    ) {
      const vector = response.data.results[0].embedding;
      setCachedEmbedding(text, vector);
      return vector;
    }

    throw new Error('Unexpected response structure from watsonx.ai embedding endpoint.');
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`watsonx.ai embedding failed: ${errorDetails}`);
  }
}

/**
 * Generates vector embeddings for a list of text strings in batches.
 * Shared directly with Gabriel's repository chunk ingestion pipeline.
 * @param {string[]} texts - Array of code or text chunks.
 * @param {object} [options] - Optional configuration (batchSize, modelId, projectId).
 * @returns {Promise<number[][]>} - Array of dense vector embeddings.
 */
async function generateEmbeddings(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const mode = requireProvider();

  if (mode === 'huggingface') {
    return generateHFEmbeddings(texts, options);
  }

  const batchSize = options.batchSize || 16;
  const modelId = options.modelId || config.embeddingModelId;
  const projectId = options.projectId || config.projectId;
  const headers = await getAuthHeaders();
  const url = `${config.url}/ml/v1/text/embeddings?version=${config.apiVersion}`;

  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const response = await axios.post(
        url,
        {
          inputs: batch,
          model_id: modelId,
          project_id: projectId,
          parameters: { truncate_input_tokens: 512 }
        },
        { headers, timeout: 30000 }
      );

      if (response.data && response.data.results) {
        for (const res of response.data.results) {
          allEmbeddings.push(res.embedding);
        }
      } else {
        throw new Error('Malformed batch response from watsonx.ai embedding API.');
      }
    } catch (error) {
      const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
      throw new Error(`watsonx.ai batch embedding failed at index ${i}: ${errorDetails}`);
    }
  }

  return allEmbeddings;
}

module.exports = {
  generateEmbedding,
  generateEmbeddings,
  getEmbeddingMode
};
