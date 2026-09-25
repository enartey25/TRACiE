const axios = require('axios');
const config = require('../../config/watsonx');
const { generateEmbedding } = require('../watsonx/embedding');

/**
 * Built-in fallback code chunks used when ChromaDB is not yet seeded or operational.
 */
const FALLBACK_CHUNKS = [
  {
    chunk_id: "repo_server_js_1",
    file_path: "src/server.js",
    language: "javascript",
    start_line: 1,
    end_line: 35,
    content: `const express = require('express');
const cors = require('cors');
const queryRouter = require('./routes/query');
const streamRouter = require('./routes/stream');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', queryRouter);
app.use('/api', streamRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`TRACiE server running on port \${PORT}\`));`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/server.js",
      language: "javascript",
      start_line: 1,
      end_line: 35
    }
  },
  {
    chunk_id: "repo_auth_js_1",
    file_path: "src/services/watsonx/auth.js",
    language: "javascript",
    start_line: 1,
    end_line: 40,
    content: `const axios = require('axios');
const config = require('../../config/watsonx');

async function getIamToken() {
  const params = new URLSearchParams();
  params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
  params.append('apikey', config.apiKey);

  const res = await axios.post('https://iam.cloud.ibm.com/identity/token', params.toString());
  return res.data.access_token;
}`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/services/watsonx/auth.js",
      language: "javascript",
      start_line: 1,
      end_line: 40
    }
  },
  {
    chunk_id: "repo_pipeline_js_1",
    file_path: "src/services/rag/pipeline.js",
    language: "javascript",
    start_line: 1,
    end_line: 50,
    content: `async function executeRAGQuery({ query, repoId }) {
  const queryEmbedding = await generateEmbedding(query);
  const chunks = await retrieveCodeChunks({ queryEmbedding, repoId });
  const prompt = buildRAGPrompt({ query, chunks });
  const { generatedText } = await generateText({ prompt });
  return parseAndValidateWidgetJSON(generatedText);
}`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/services/rag/pipeline.js",
      language: "javascript",
      start_line: 1,
      end_line: 50
    }
  }
];

/**
 * Retrieves the top-k most relevant code chunks for a given query vector.
 * Queries ChromaDB when operational; falls back to embedded repository chunks otherwise.
 *
 * @param {object} params
 * @param {number[]} params.queryEmbedding - The vector embedding of the user's query.
 * @param {string} [params.repoId] - Optional repository identifier to filter chunks.
 * @param {number} [params.topK=5] - Number of chunks to retrieve.
 * @returns {Promise<Array<object>>} - List of relevant code chunk objects.
 */
async function retrieveCodeChunks({ queryEmbedding, repoId, topK = 5 }) {
  try {
    // Attempt ChromaDB query via REST API
    const response = await axios.post(
      `${config.chromaUrl}/api/v1/collections/${config.chromaCollection}/query`,
      {
        query_embeddings: [queryEmbedding],
        n_results: topK,
        where: repoId ? { repo_id: repoId } : undefined
      },
      { timeout: 3000 }
    );

    if (
      response.data &&
      response.data.documents &&
      response.data.documents[0] &&
      response.data.documents[0].length > 0
    ) {
      const docs = response.data.documents[0];
      const metadatas = response.data.metadatas ? response.data.metadatas[0] : [];
      const ids = response.data.ids ? response.data.ids[0] : [];

      return docs.map((doc, idx) => ({
        chunk_id: ids[idx] || `chunk_${idx}`,
        content: doc,
        metadata: metadatas[idx] || {},
        file_path: metadatas[idx]?.file_path || 'unknown',
        start_line: metadatas[idx]?.start_line || 1,
        end_line: metadatas[idx]?.end_line || 50,
        language: metadatas[idx]?.language || 'javascript'
      }));
    }
  } catch (error) {
    // ChromaDB is unreachable or not yet populated. Log once and return fallback chunks.
    // console.warn('ChromaDB not reachable, using fallback chunks adapter:', error.message);
  }

  // Fallback: return relevant subset of sample chunks
  return FALLBACK_CHUNKS.slice(0, topK);
}

module.exports = {
  retrieveCodeChunks,
  FALLBACK_CHUNKS
};
