const axios = require('axios');
const config = require('../../config/watsonx');
const { getAuthHeaders, hasValidCredentials } = require('./auth');

/**
 * Generates a deterministic mock embedding vector (normalized float array)
 * for testing when live watsonx credentials are not supplied.
 */
function generateMockEmbedding(text, dimensions = 768) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const vector = [];
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin(hash + i);
    vector.push(val);
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map(v => v / norm);
}

/**
 * Generates a vector embedding for a single text string using IBM watsonx.ai.
 * @param {string} text - The input text to embed.
 * @param {object} [options] - Optional overrides (modelId, projectId).
 * @returns {Promise<number[]>} - Dense vector of floating point numbers.
 */
async function generateEmbedding(text, options = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text must be a non-empty string.');
  }

  if (!hasValidCredentials()) {
    return generateMockEmbedding(text);
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
        project_id: projectId
      },
      { headers, timeout: 15000 }
    );

    if (
      response.data &&
      response.data.results &&
      response.data.results[0] &&
      response.data.results[0].embedding
    ) {
      return response.data.results[0].embedding;
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

  if (!hasValidCredentials()) {
    return texts.map(t => generateMockEmbedding(t));
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
          project_id: projectId
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
  generateMockEmbedding
};
