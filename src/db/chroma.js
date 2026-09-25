const { ChromaClient, CloudClient } = require('chromadb');
const config = require('../config/backend');

/**
 * ChromaDB access for the `code_chunks` collection.
 *
 * Each document = one code chunk. Stored fields:
 *   id        -> chunk_id  ({repositoryId}_{filePath}_{startLine})
 *   embedding -> vector from the embedding service
 *   document  -> chunk_text (raw code)
 *   metadata  -> chunk_id, repository_id, file_path, language, start_line,
 *                end_line, module_name, symbols
 *
 * Ethan: queryChunks() below is the retrieval helper for the RAG pipeline.
 */

let client = null;
let collectionPromise = null;

function getClient() {
  if (!client && config.chromaApiKey) {
    client = new CloudClient({
      apiKey: config.chromaApiKey,
      tenant: config.chromaTenant || undefined,
      database: config.chromaDatabase || undefined
    });
  }
  if (!client) {
    const url = new URL(config.chromaUrl);
    client = new ChromaClient({
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80),
      ssl: url.protocol === 'https:'
    });
  }
  return client;
}

/** Get (or lazily create) the code_chunks collection. We always supply our own embeddings. */
function getCollection() {
  if (!collectionPromise) {
    collectionPromise = getClient()
      .getOrCreateCollection({
        name: config.chromaCollection,
        embeddingFunction: null,
        configuration: { hnsw: { space: 'cosine' } }
      })
      .catch((error) => {
        collectionPromise = null; // allow retry on next call
        throw error;
      });
  }
  return collectionPromise;
}

/** Returns { ok, latencyMs, chunkCount?, error? } — used by /api/health. */
async function ping() {
  const started = Date.now();
  try {
    await getClient().heartbeat();
    const collection = await getCollection();
    const chunkCount = await collection.count();
    return { ok: true, mode: config.chromaApiKey ? 'cloud' : 'local', latencyMs: Date.now() - started, chunkCount };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Upsert a batch of chunks.
 * @param {Array<{chunkId, repositoryId, filePath, language, text, embedding, startLine, endLine, moduleName, symbols}>} chunks
 */
async function upsertChunks(chunks) {
  if (!chunks.length) return;
  const collection = await getCollection();
  await collection.upsert({
    ids: chunks.map(c => c.chunkId),
    embeddings: chunks.map(c => c.embedding),
    documents: chunks.map(c => c.text),
    metadatas: chunks.map(c => ({
      chunk_id: c.chunkId,
      repository_id: c.repositoryId,
      repo_id: c.repositoryId, // alias: Ethan's retriever currently filters on `repo_id`
      file_path: c.filePath,
      language: c.language,
      start_line: c.startLine,
      end_line: c.endLine,
      module_name: c.moduleName || '',
      symbols: c.symbols || ''
    }))
  });
}

/** Remove every chunk belonging to a repository (used before a re-index). */
async function deleteRepositoryChunks(repositoryId) {
  const collection = await getCollection();
  await collection.delete({ where: { repository_id: repositoryId } });
}

/**
 * Nearest-neighbour search over code chunks.
 * @param {object} params
 * @param {number[]} params.embedding - query vector (same model as ingestion)
 * @param {string} [params.repositoryId] - restrict to one repository
 * @param {number} [params.topK=5]
 * @returns {Promise<Array<{chunk_id, content, file_path, language, start_line, end_line, module_name, distance, metadata}>>}
 */
async function queryChunks({ embedding, repositoryId, topK = 5 }) {
  const collection = await getCollection();
  const result = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where: repositoryId ? { repository_id: repositoryId } : undefined,
    include: ['documents', 'metadatas', 'distances']
  });

  const ids = result.ids[0] || [];
  return ids.map((id, i) => {
    const metadata = (result.metadatas[0] || [])[i] || {};
    return {
      chunk_id: id,
      content: (result.documents[0] || [])[i] || '',
      file_path: metadata.file_path,
      language: metadata.language,
      start_line: metadata.start_line,
      end_line: metadata.end_line,
      module_name: metadata.module_name,
      distance: (result.distances[0] || [])[i],
      metadata
    };
  });
}

module.exports = { getClient, getCollection, ping, upsertChunks, deleteRepositoryChunks, queryChunks };
