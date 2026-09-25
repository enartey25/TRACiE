require('dotenv').config();

/**
 * Gabriel's backend infrastructure config (Postgres, ChromaDB, ingestion).
 * Ethan's LLM/watsonx config lives in ./watsonx.js.
 */
const databaseUrl = process.env.DATABASE_URL || '';

const config = {
  databaseUrl,
  // Supabase (and most hosted Postgres) require SSL; local Postgres usually doesn't.
  databaseSsl: process.env.DATABASE_SSL
    ? process.env.DATABASE_SSL === 'true'
    : /supabase\.(co|com)/.test(databaseUrl),

  chromaUrl: process.env.CHROMADB_URL || 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION_NAME || 'code_chunks',
  // Chroma Cloud (shared by the whole team). When CHROMA_API_KEY is set, CHROMADB_URL is ignored.
  chromaApiKey: process.env.CHROMA_API_KEY || '',
  chromaTenant: process.env.CHROMA_TENANT || '',
  chromaDatabase: process.env.CHROMA_DATABASE || '',

  githubToken: process.env.GITHUB_TOKEN || '',
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',

  ingestion: {
    // Keep chunks under the embedding model's input limit (granite-embedding-125m = 512 tokens).
    maxChunkChars: parseInt(process.env.INGEST_MAX_CHUNK_CHARS, 10) || 1500,
    maxChunkLines: parseInt(process.env.INGEST_MAX_CHUNK_LINES, 10) || 60,
    maxFileBytes: parseInt(process.env.INGEST_MAX_FILE_BYTES, 10) || 300 * 1024,
    embedBatchSize: parseInt(process.env.INGEST_EMBED_BATCH_SIZE, 10) || 32,
    workDir: process.env.INGEST_WORK_DIR || ''
  }
};

module.exports = config;
