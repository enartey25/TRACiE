const axios = require('axios');
const config = require('../../config/watsonx');
const { generateEmbedding } = require('../watsonx/embedding');
const { queryChunks } = require('../../db/chroma');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Built-in fallback code chunks used when ChromaDB is not yet seeded or operational.
 * Covers all TRACiE subsystems: Database/Postgres, Vector Store/ChromaDB, Memory, Audio, Server, Auth.
 */
const FALLBACK_CHUNKS = [
  {
    chunk_id: "repo_database_pg_schema",
    file_path: "src/services/db/schema.sql",
    language: "sql",
    start_line: 1,
    end_line: 45,
    keywords: ["database", "postgres", "postgresql", "sql", "schema", "tables", "relations", "users", "sessions", "queries", "doc_proposals", "db", "storage"],
    content: `-- TRACiE PostgreSQL Relational Database Schema
-- Managed by backend persistence for multi-turn sessions, query telemetry, and doc proposals
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'developer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_title VARCHAR(255) NOT NULL,
  bobcoins_consumed NUMERIC(8, 2) DEFAULT 0.0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  routed_agent VARCHAR(100) NOT NULL,
  widget_type VARCHAR(100) NOT NULL,
  response_payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE doc_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  target_file VARCHAR(255) NOT NULL,
  diff_markdown TEXT NOT NULL,
  rationale TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/services/db/schema.sql",
      language: "sql",
      start_line: 1,
      end_line: 45
    }
  },
  {
    chunk_id: "repo_database_chroma_config",
    file_path: "src/config/watsonx.js",
    language: "javascript",
    start_line: 1,
    end_line: 40,
    keywords: ["database", "chroma", "chromadb", "vector", "embedding", "collection", "chunks", "store", "ann", "db", "storage"],
    content: `// ChromaDB Vector Store & Database Configuration
// TRACiE uses dual-tier persistence:
// 1. ChromaDB (Vector Store on port 8000): Stores dense 768-dimensional Granite embeddings
//    in the 'code_chunks' collection for fast cosine ANN similarity retrieval.
// 2. PostgreSQL (Relational Database): Stores sessions, query telemetry, citations, and doc proposals.
module.exports = {
  chromaUrl: process.env.CHROMADB_URL || 'http://localhost:8000',
  chromaCollection: process.env.CHROMA_COLLECTION_NAME || 'code_chunks',
  embeddingModel: 'ibm/granite-embedding-125m-english',
  embeddingDimension: 768
};`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/config/watsonx.js",
      language: "javascript",
      start_line: 1,
      end_line: 40
    }
  },
  {
    chunk_id: "repo_session_memory",
    file_path: "src/services/memory/sessionMemory.js",
    language: "javascript",
    start_line: 1,
    end_line: 35,
    keywords: ["memory", "session", "turns", "history", "store", "cache", "context", "state"],
    content: `// In-Memory Multi-Turn Session Store
const sessions = new Map();

function addTurn(sessionId, role, text, widgetPayload = null) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, []);
  const history = sessions.get(sessionId);
  history.push({ role, text, widgetPayload, timestamp: Date.now() });
  if (history.length > 10) history.shift(); // 10-turn sliding window
}

function getSessionHistory(sessionId) {
  return sessions.get(sessionId) || [];
}`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/services/memory/sessionMemory.js",
      language: "javascript",
      start_line: 1,
      end_line: 35
    }
  },
  {
    chunk_id: "repo_audio_tts",
    file_path: "src/services/audio/ttsService.js",
    language: "javascript",
    start_line: 1,
    end_line: 40,
    keywords: ["audio", "voice", "speech", "tts", "elevenlabs", "briefing", "podcast", "sound"],
    content: `// TRACiE Audio Briefing / Text-to-Speech (TTS) Service
// Dual-tier synthesis:
// 1. ElevenLabs API (model: eleven_turbo_v2_5, voice: Adam pNInz6obpgDQGcFmaJgB)
//    Produces studio-quality human voice briefings.
// 2. Web Speech API (zero-dependency browser fallback)
async function synthesizeBriefing({ title, text }) { ... }`,
    metadata: {
      repo_id: "TRACiE",
      file_path: "src/services/audio/ttsService.js",
      language: "javascript",
      start_line: 1,
      end_line: 40
    }
  },
  {
    chunk_id: "repo_server_js_1",
    file_path: "src/server.js",
    language: "javascript",
    start_line: 1,
    end_line: 35,
    keywords: ["server", "express", "routes", "api", "port", "app", "cors"],
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
    keywords: ["auth", "watsonx", "iam", "token", "apikey", "ibm", "oauth"],
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
    keywords: ["rag", "pipeline", "orchestrator", "retrieval", "prompt", "query"],
    content: `async function executeRAGQuery({ query, repoId }) {
  const queryEmbedding = await generateEmbedding(query);
  const chunks = await retrieveCodeChunks({ query, queryEmbedding, repoId });
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
 * Queries ChromaDB when operational; falls back to embedded repository chunks with smart keyword matching.
 *
 * @param {object} params
 * @param {string} [params.query] - The user query text for semantic keyword ranking.
 * @param {number[]} params.queryEmbedding - The vector embedding of the user's query.
 * @param {string} [params.repoId] - Optional repository identifier to filter chunks.
 * @param {number} [params.topK=5] - Number of chunks to retrieve.
 * @returns {Promise<Array<object>>} - List of relevant code chunk objects.
 */
async function retrieveCodeChunks({ query, queryEmbedding, repoId, topK = 5 }) {
  // [Gabriel] Primary path: indexed repository chunks via the shared Chroma client
  // (local or Chroma Cloud, per .env). repoId = repositoryId from /api/repos; a non-UUID
  // repoId (e.g. "TRACiE") searches all indexed repos. Code chunks only by default; git
  // history lives in the same collection — see queryChunks({ chunkTypes: ['commit', 'pull_request'] }).
  try {
    const hits = await queryChunks({
      embedding: queryEmbedding,
      repositoryId: UUID_RE.test(repoId || '') ? repoId : undefined,
      chunkTypes: ['code'],
      topK
    });
    if (hits.length > 0) return hits;
  } catch (error) {
    console.warn('[retriever] Chroma query failed, using fallback:', error.message);
  }

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
    // ChromaDB is unreachable or not yet populated. Fallback to ranked local chunks.
  }

  // Fallback: Rank chunks by keyword relevance to the user's query
  if (query && typeof query === 'string') {
    const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = FALLBACK_CHUNKS.map(chunk => {
      let score = 0;
      const kws = chunk.keywords || [];
      const pathLower = chunk.file_path.toLowerCase();
      const contentLower = chunk.content.toLowerCase();

      for (const word of qWords) {
        if (kws.includes(word)) score += 15;
        if (pathLower.includes(word)) score += 10;
        if (contentLower.includes(word)) score += 3;
      }
      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(s => s.chunk);
  }

  return FALLBACK_CHUNKS.slice(0, topK);
}

module.exports = {
  retrieveCodeChunks,
  FALLBACK_CHUNKS
};
