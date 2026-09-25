const fs = require('fs');
const config = require('../../config/backend');
const { cloneRepository, redact } = require('./fetchRepo');
const { walkRepository, looksBinaryOrMinified } = require('./fileWalker');
const { chunkFile, moduleNameFor } = require('./chunker');
const { embedTexts } = require('./embedder');
const chroma = require('../../db/chroma');
const repoStore = require('../repos/repoStore');
const { decrypt } = require('../../utils/crypto');

/**
 * Repository ingestion pipeline:
 *   clone -> walk file tree -> chunk (tree-sitter / fallback) -> embed -> upsert into ChromaDB
 * Progress is written to indexing_jobs so GET /api/repos/:id/status can be polled.
 *
 * Failure policy: a file that fails to read/chunk, or a chunk that fails to embed,
 * is logged and skipped. Only clone/infrastructure failures fail the whole job.
 */

const log = (jobId, msg) => console.log(`[ingestion ${jobId.slice(0, 8)}] ${msg}`);

/** Text sent to the embedding model: a little context header + the code. */
function embeddingInput(chunk) {
  const header = [`File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`];
  if (chunk.symbols) header.push(`Symbols: ${chunk.symbols}`);
  return `${header.join('\n')}\n\n${chunk.text}`;
}

async function buildChunks({ repositoryId, dir, jobId }) {
  const files = walkRepository(dir, { maxFileBytes: config.ingestion.maxFileBytes });
  await repoStore.updateJob(jobId, { files_total: files.length });
  log(jobId, `${files.length} indexable files`);

  const chunks = [];
  const seenIds = new Set();
  const methods = { 'tree-sitter': 0, markdown: 0, window: 0, skipped: 0 };

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file.absPath);
      if (looksBinaryOrMinified(buffer)) {
        methods.skipped++;
        continue;
      }
      const { chunks: fileChunks, method } = await chunkFile({
        text: buffer.toString('utf8'),
        language: file.language,
        limits: config.ingestion
      });
      methods[method]++;

      for (const c of fileChunks) {
        // Spec format: {repositoryId}_{filePath}_{startLine}; suffix only on rare same-line collisions.
        let chunkId = `${repositoryId}_${file.relPath}_${c.startLine}`;
        for (let n = 2; seenIds.has(chunkId); n++) chunkId = `${repositoryId}_${file.relPath}_${c.startLine}_${n}`;
        seenIds.add(chunkId);
        chunks.push({
          chunkId,
          repositoryId,
          filePath: file.relPath,
          language: file.language,
          text: c.text,
          startLine: c.startLine,
          endLine: c.endLine,
          moduleName: moduleNameFor(file.relPath),
          symbols: c.symbols.join(', ')
        });
      }
    } catch (error) {
      methods.skipped++;
      log(jobId, `skipping ${file.relPath}: ${error.message}`);
    }
  }

  log(jobId, `chunked: ${chunks.length} chunks (${JSON.stringify(methods)})`);
  return chunks;
}

/** Embed a batch; if the batch call fails, retry one-by-one so one bad chunk can't sink the batch. */
async function embedBatch(batch, jobId) {
  try {
    const vectors = await embedTexts(batch.map(embeddingInput));
    if (vectors.length !== batch.length) throw new Error(`expected ${batch.length} vectors, got ${vectors.length}`);
    batch.forEach((c, i) => { c.embedding = vectors[i]; });
    return { ok: batch, failed: 0 };
  } catch (batchError) {
    log(jobId, `batch embed failed (${batchError.message}); retrying individually`);
    const ok = [];
    for (const c of batch) {
      try {
        const [vector] = await embedTexts([embeddingInput(c)]);
        c.embedding = vector;
        ok.push(c);
      } catch (error) {
        log(jobId, `embed failed for ${c.chunkId}: ${error.message}`);
      }
    }
    return { ok, failed: batch.length - ok.length };
  }
}

async function runJob({ repository, job, token }) {
  const jobId = job.id;
  let cleanup = () => {};
  try {
    await repoStore.updateJob(jobId, { status: 'running', stage: 'cloning' });
    await repoStore.setRepositoryStatus(repository.id, 'indexing');
    log(jobId, `cloning ${repository.url}`);

    const clone = await cloneRepository({ url: repository.url, token, jobId });
    cleanup = clone.cleanup;

    await repoStore.updateJob(jobId, { stage: 'parsing' });
    const chunks = await buildChunks({ repositoryId: repository.id, dir: clone.dir, jobId });
    await repoStore.updateJob(jobId, { stage: 'embedding', chunks_total: chunks.length });

    // Re-index: drop the previous generation of chunks for this repo.
    await chroma.deleteRepositoryChunks(repository.id);

    let done = 0;
    let failed = 0;
    const batchSize = config.ingestion.embedBatchSize;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const result = await embedBatch(batch, jobId);
      await chroma.upsertChunks(result.ok);
      result.ok.forEach(c => { c.embedding = null; }); // free memory
      done += batch.length;
      failed += result.failed;
      await repoStore.updateJob(jobId, { chunks_done: done, chunks_failed: failed });
    }

    if (chunks.length > 0 && failed === chunks.length) {
      throw new Error('Every chunk failed to embed — check the embedding service configuration.');
    }

    // Repo first, so a client that sees job=complete never sees repo=indexing.
    await repoStore.setRepositoryStatus(repository.id, 'ready', { lastIndexed: new Date(), commitSha: clone.commitSha });
    await repoStore.updateJob(jobId, { status: 'complete', stage: 'done', completed_at: new Date() });
    log(jobId, `complete: ${done - failed}/${chunks.length} chunks stored`);
  } catch (error) {
    const message = redact(error.message, token);
    log(jobId, `FAILED: ${message}`);
    await repoStore
      .updateJob(jobId, { status: 'failed', error_message: message, completed_at: new Date() })
      .catch(e => console.error('[ingestion] could not record failure:', e.message));
    await repoStore.setRepositoryStatus(repository.id, 'failed').catch(() => {});
  } finally {
    cleanup();
  }
}

/**
 * Create an indexing job and run it in the background.
 * Entry point for POST /api/repos, POST /api/repos/:id/reindex,
 * and (Phase 2) the GitHub push webhook.
 * @returns {Promise<object>} the created indexing_jobs row
 */
async function startIngestion(repository) {
  const encrypted = await repoStore.getRepositoryToken(repository.id);
  const token = encrypted ? decrypt(encrypted) : null;
  const job = await repoStore.createJob(repository.id);
  setImmediate(() => {
    runJob({ repository, job, token }).catch(e => console.error('[ingestion] unexpected error:', e));
  });
  return job;
}

module.exports = { startIngestion, runJob };
