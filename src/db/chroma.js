const crypto = require('crypto');
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

/**
 * Collection name for the active embedding model, e.g. "code_chunks__huggingface-sentence-transformers-all-minilm-l6-v2".
 *
 * A Chroma collection locks its vector dimension on first insert. The team shares one
 * Chroma database but not always one embedding model (watsonx granite = 768 dims,
 * HF MiniLM = 384), so a single shared "code_chunks" collection rejected every upsert
 * from whichever environment disagreed ("expecting embedding with dimension of 768, got 384")
 * and silently returned nothing on query. One collection per model keeps them apart.
 */
function collectionName() {
  const { getEmbeddingModelKey } = require('../services/watsonx/embedding');
  const key = getEmbeddingModelKey();
  if (!key) return config.chromaCollection;
  const slug = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // Chroma names: 3-512 chars of [a-zA-Z0-9._-], starting and ending alphanumeric.
  return `${config.chromaCollection}__${slug}`.slice(0, 200).replace(/[^a-z0-9]+$/i, '');
}

/** Get (or lazily create) the chunk collection for the active embedding model. We always supply our own embeddings. */
function getCollection() {
  if (!collectionPromise) {
    collectionPromise = getClient()
      .getOrCreateCollection({
        name: collectionName(),
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
    return { ok: true, mode: config.chromaApiKey ? 'cloud' : 'local', collection: collection.name, latencyMs: Date.now() - started, chunkCount };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

/**
 * Chroma Cloud rejects record ids over 128 bytes, and chunk ids embed the file path
 * ({repositoryId}_{filePath}_{startLine}), so deep paths used to fail the whole job.
 * Long ids are shortened deterministically (repository prefix + hash), so re-indexing
 * still overwrites the same record. The full id stays in metadata.chunk_id.
 */
const MAX_ID_BYTES = 128;
function storedId(chunkId) {
  if (Buffer.byteLength(chunkId, 'utf8') <= MAX_ID_BYTES) return chunkId;
  return `${chunkId.slice(0, 36)}_h${crypto.createHash('sha256').update(chunkId).digest('hex').slice(0, 48)}`;
}

/**
 * Upsert a batch of chunks.
 * @param {Array<{chunkId, repositoryId, chunkType?, filePath, language, text, embedding, startLine, endLine,
 *                moduleName, symbols, extra?}>} chunks
 *   chunkType: 'code' (default) | 'commit' | 'pull_request'
 *   extra: additional flat metadata (string/number/boolean values only), e.g. commit_sha, pr_number
 */
// Chroma Cloud's free tier rejects upserts of more than 300 records per request.
const UPSERT_BATCH = 250;

async function upsertChunks(chunks) {
  if (!chunks.length) return;
  const collection = await getCollection();
  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    await upsertBatch(collection, chunks.slice(i, i + UPSERT_BATCH));
  }
}

async function upsertBatch(collection, chunks) {
  await collection.upsert({
    ids: chunks.map(c => storedId(c.chunkId)),
    embeddings: chunks.map(c => c.embedding),
    documents: chunks.map(c => c.text),
    metadatas: chunks.map(c => ({
      ...(c.extra || {}),
      chunk_id: c.chunkId,
      chunk_type: c.chunkType || 'code',
      repository_id: c.repositoryId,
      repo_id: c.repositoryId, // alias: Ethan's original retriever filtered on `repo_id`
      file_path: c.filePath || '',
      language: c.language || '',
      start_line: c.startLine || 0,
      end_line: c.endLine || 0,
      module_name: c.moduleName || '',
      symbols: c.symbols || ''
    }))
  });
}

/** True when the active collection holds at least one chunk for the repository. */
async function hasRepositoryChunks(repositoryId) {
  const collection = await getCollection();
  const result = await collection.get({ where: { repository_id: repositoryId }, limit: 1, include: [] });
  return result.ids.length > 0;
}

/** Remove every chunk belonging to a repository (used before a full re-index). */
async function deleteRepositoryChunks(repositoryId) {
  const collection = await getCollection();
  await collection.delete({ where: { repository_id: repositoryId } });
}

/** Remove the code chunks of specific files (changed/removed files during an incremental re-index). */
async function deleteFileChunks(repositoryId, filePaths) {
  const collection = await getCollection();
  for (let i = 0; i < filePaths.length; i += 100) {
    await collection.delete({
      where: { $and: [{ repository_id: repositoryId }, { file_path: { $in: filePaths.slice(i, i + 100) } }] }
    });
  }
}

/** Generic metadata-filtered delete, e.g. { pr_number: 12 } within a repository. */
async function deleteWhere(repositoryId, filter) {
  const collection = await getCollection();
  await collection.delete({ where: { $and: [{ repository_id: repositoryId }, filter] } });
}

/** Of the given ids, return a Map id -> metadata for those already stored. */
async function getExisting(ids) {
  const collection = await getCollection();
  const found = new Map();
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const original = new Map(batch.map(id => [storedId(id), id]));
    const result = await collection.get({ ids: [...original.keys()], include: ['metadatas'] });
    result.ids.forEach((id, j) => found.set(original.get(id) || id, result.metadatas[j] || {}));
  }
  return found;
}

/**
 * Nearest-neighbour search over chunks.
 * @param {object} params
 * @param {number[]} params.embedding - query vector (same model as ingestion)
 * @param {string} [params.repositoryId] - restrict to one repository
 * @param {string[]} [params.chunkTypes] - restrict to types, e.g. ['code'] or ['commit', 'pull_request']
 * @param {number} [params.topK=5]
 * @returns {Promise<Array<{chunk_id, chunk_type, content, file_path, language, start_line, end_line, module_name, distance, metadata}>>}
 */
async function queryChunks({ embedding, repositoryId, chunkTypes, topK = 5 }) {
  const collection = await getCollection();
  const filters = [];
  if (repositoryId) filters.push({ repository_id: repositoryId });
  if (chunkTypes && chunkTypes.length) filters.push({ chunk_type: { $in: chunkTypes } });

  const result = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    where: filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { $and: filters },
    include: ['documents', 'metadatas', 'distances']
  });

  const ids = result.ids[0] || [];
  return ids.map((id, i) => {
    const metadata = (result.metadatas[0] || [])[i] || {};
    return {
      chunk_id: metadata.chunk_id || id,
      chunk_type: metadata.chunk_type || 'code',
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

/**
 * Fetch stored chunks for a repository directly without requiring a query embedding.
 */
async function getRepositoryChunks({ repositoryId, chunkTypes, limit = 15 }) {
  const collection = await getCollection();
  const filters = [];
  if (repositoryId) filters.push({ repository_id: repositoryId });
  if (chunkTypes && chunkTypes.length) filters.push({ chunk_type: { $in: chunkTypes } });

  const where = filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : { $and: filters };
  const result = await collection.get({
    where,
    limit,
    include: ['documents', 'metadatas']
  });

  const ids = result.ids || [];
  return ids.map((id, i) => {
    const metadata = (result.metadatas || [])[i] || {};
    return {
      chunk_id: metadata.chunk_id || id,
      chunk_type: metadata.chunk_type || 'code',
      content: (result.documents || [])[i] || '',
      file_path: metadata.file_path,
      language: metadata.language,
      start_line: metadata.start_line,
      end_line: metadata.end_line,
      module_name: metadata.module_name,
      metadata
    };
  });
}

/**
 * Fetch every stored chunk for specific files in a repository (exact file_path match).
 * Used to force-include a file's content when the user names it explicitly in their
 * query, since semantic top-K can rank a short/administrative file (e.g. README.md)
 * below unrelated code when the query's wording doesn't closely match its content.
 */
async function getChunksByFilePath({ repositoryId, filePaths, limit = 20 }) {
  if (!filePaths || !filePaths.length) return [];
  const collection = await getCollection();
  const result = await collection.get({
    where: { $and: [{ repository_id: repositoryId }, { file_path: { $in: filePaths } }] },
    limit,
    include: ['documents', 'metadatas']
  });

  const ids = result.ids || [];
  return ids.map((id, i) => {
    const metadata = (result.metadatas || [])[i] || {};
    return {
      chunk_id: metadata.chunk_id || id,
      chunk_type: metadata.chunk_type || 'code',
      content: (result.documents || [])[i] || '',
      file_path: metadata.file_path,
      language: metadata.language,
      start_line: metadata.start_line,
      end_line: metadata.end_line,
      module_name: metadata.module_name,
      distance: 0,
      metadata
    };
  });
}

module.exports = {
  getClient, getCollection, collectionName, ping, upsertChunks, hasRepositoryChunks, deleteRepositoryChunks, deleteFileChunks, deleteWhere,
  getExisting, queryChunks, getRepositoryChunks, getChunksByFilePath
};
