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
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || '',

  history: {
    enabled: process.env.INGEST_HISTORY !== 'false',
    maxCommits: parseInt(process.env.HISTORY_MAX_COMMITS, 10) || 200,
    maxPullRequests: parseInt(process.env.HISTORY_MAX_PRS, 10) || 100
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY || '',

  ingestion: {
    // Keep chunks under the embedding model's input limit (granite-embedding-125m = 512 tokens).
    maxChunkChars: parseInt(process.env.INGEST_MAX_CHUNK_CHARS, 10) || 1500,
    maxChunkLines: parseInt(process.env.INGEST_MAX_CHUNK_LINES, 10) || 60,
    maxFileBytes: parseInt(process.env.INGEST_MAX_FILE_BYTES, 10) || 300 * 1024,
    // Chunks handed to the embedding provider per pipeline iteration. For HuggingFace this is
    // split further into DEFAULT_BATCH_SIZE (32) requests run DEFAULT_CONCURRENCY (16) at a time
    // (see services/huggingface/embedding.js) — 512 here keeps all 16 of those requests in
    // flight per iteration. Keep it = 32 x HF_EMBED_CONCURRENCY if you change either.
    embedBatchSize: parseInt(process.env.INGEST_EMBED_BATCH_SIZE, 10) || 512,
    workDir: process.env.INGEST_WORK_DIR || ''
  }
};

module.exports = config;
