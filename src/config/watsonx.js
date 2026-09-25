require('dotenv').config();

const config = {
  apiKey: process.env.WATSONX_APIKEY || '',
  projectId: process.env.WATSONX_PROJECT_ID || '',
  url: process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com',
  apiVersion: '2023-05-29',
  embeddingModelId: process.env.WATSONX_EMBEDDING_MODEL_ID || 'ibm/granite-embedding-125m-english',
  generationModelId: process.env.WATSONX_GENERATION_MODEL_ID || 'ibm/granite-3-8b-instruct',
  chromaUrl: process.env.CHROMADB_URL || 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION_NAME || 'code_chunks',
  port: parseInt(process.env.PORT, 10) || 3000
};

module.exports = config;
