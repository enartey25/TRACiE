const fs = require('fs');
const config = require('../../config/backend');
const { cloneRepository, listBlobShas, parseGitHubUrl, redact } = require('./fetchRepo');
const { walkRepository, looksBinaryOrMinified } = require('./fileWalker');
const { chunkFile, moduleNameFor } = require('./chunker');
const { embedTexts } = require('./embedder');
const { ingestHistory, describeGitHubError } = require('./history');
const chroma = require('../../db/chroma');
const repoStore = require('../repos/repoStore');
const { decrypt } = require('../../utils/crypto');

/**
 * Repository ingestion pipeline:
 *   clone -> walk file tree -> diff blob SHAs vs indexed_files -> chunk changed files
 *   (tree-sitter / fallback) -> embed -> upsert into ChromaDB -> commit/PR history
 * Progress is written to indexing_jobs so GET /api/repos/:id/status can be polled.
 *
 * Incremental: files whose git blob SHA matches indexed_files are skipped; chunks of
 * changed/removed files are deleted first. A full rebuild happens on the first run,
 * when indexed_files is empty, or when the job was created with full=true.
 *
 * Failure policy: a file that fails to read/chunk, or a chunk that fails to embed,
 * is logged and skipped. Only clone/infrastructure failures fail the whole job.
 * History (commits/PRs) failures never fail the job.
 */

const log = (jobId, msg) => console.log(`[ingestion ${jobId.slice(0, 8)}] ${msg}`);

/** Text sent to the embedding model: a little context header + the code. */
function embeddingInput(chunk) {
  const header = [`File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`];
  if (chunk.symbols) header.push(`Symbols: ${chunk.symbols}`);
  return `${header.join('\n')}\n\n${chunk.text}`;
}

/**
 * Chunk the given files.
 * @returns {{ chunks: object[], emptyFiles: Array<{ filePath }> }} emptyFiles = handled fine but produced no chunks
 */
async function buildChunks({ repositoryId, files, jobId }) {
  const chunks = [];
  const emptyFiles = [];
  const seenIds = new Set();
  const methods = { 'tree-sitter': 0, markdown: 0, window: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file.absPath);
      if (looksBinaryOrMinified(buffer)) {
        methods.skipped++;
        emptyFiles.push({ filePath: file.relPath });
        continue;
      }
      const { chunks: fileChunks, method } = await chunkFile({
        text: buffer.toString('utf8'),
        language: file.language,
        limits: config.ingestion
      });
      methods[method]++;
      if (!fileChunks.length) emptyFiles.push({ filePath: file.relPath });

      for (const c of fileChunks) {
        // Spec format: {repositoryId}_{filePath}_{startLine}; suffix only on rare same-line collisions.
        let chunkId = `${repositoryId}_${file.relPath}_${c.startLine}`;
        for (let n = 2; seenIds.has(chunkId); n++) chunkId = `${repositoryId}_${file.relPath}_${c.startLine}_${n}`;
        seenIds.add(chunkId);
        chunks.push({
          chunkId,
          repositoryId,
          chunkType: 'code',
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
      methods.failed++;
      log(jobId, `skipping ${file.relPath}: ${error.message}`);
    }
  }

  log(jobId, `chunked ${files.length} files -> ${chunks.length} chunks (${JSON.stringify(methods)})`);
  return { chunks, emptyFiles };
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

/** Decide which files need (re)indexing and clear out their stale chunks. */
async function planIncremental({ repository, job, files, shas }) {
  const previous = job.full_reindex ? new Map() : await repoStore.getIndexedFiles(repository.id);

  if (previous.size === 0) {
    // First run, full rebuild, or pre-Phase-2 data without SHA tracking: start clean.
    await chroma.deleteRepositoryChunks(repository.id);
    await repoStore.deleteIndexedFiles(repository.id);
    return { changed: files, removed: [] };
  }

  const currentPaths = new Set(files.map(f => f.relPath));
  const changed = files.filter(f => !shas.get(f.relPath) || previous.get(f.relPath) !== shas.get(f.relPath));
  const removed = [...previous.keys()].filter(p => !currentPaths.has(p));
  const stale = [...changed.filter(f => previous.has(f.relPath)).map(f => f.relPath), ...removed];

  // Drop tracking rows together with chunks, so an interrupted job re-processes these files next time.
  await chroma.deleteFileChunks(repository.id, stale);
  await repoStore.deleteIndexedFiles(repository.id, stale);
  return { changed, removed };
}

async function runHistoryStage({ repository, jobId, token }) {
  if (!config.history.enabled) {
    await repoStore.updateJob(jobId, { history_status: 'skipped' });
    return;
  }
  const parsed = parseGitHubUrl(repository.url);
  await repoStore.updateJob(jobId, { stage: 'history', history_status: 'running' });
  try {
    const result = await ingestHistory({
      repositoryId: repository.id,
      owner: parsed.owner,
      repo: parsed.repo,
      token,
      log: msg => log(jobId, msg)
    });
    await repoStore.updateJob(jobId, { history_status: 'complete', history_chunks: result.chunksStored });
    await repoStore.setHistoryIndexed(repository.id);
  } catch (error) {
    // History is a bonus: never fail the job because of it.
    const message = redact(describeGitHubError(error), token);
    log(jobId, `history failed: ${message}`);
    await repoStore.updateJob(jobId, { history_status: 'failed', history_error: message });
  }
}

async function runJob({ repository, job, token }) {
  const jobId = job.id;
  let cleanup = () => {};
  try {
    await repoStore.updateJob(jobId, { status: 'running', stage: 'cloning' });
    // A re-index of an already-searchable repo keeps it 'ready' so chat keeps working meanwhile.
    if (repository.index_status !== 'ready') await repoStore.setRepositoryStatus(repository.id, 'indexing');
    log(jobId, `cloning ${repository.url} (trigger=${job.trigger}${job.full_reindex ? ', full' : ''})`);

    const clone = await cloneRepository({ url: repository.url, token, jobId });
    cleanup = clone.cleanup;

    await repoStore.updateJob(jobId, { stage: 'parsing' });
    const files = walkRepository(clone.dir, { maxFileBytes: config.ingestion.maxFileBytes });
    const shas = await listBlobShas(clone.dir);
    const { changed, removed } = await planIncremental({ repository, job, files, shas });
    await repoStore.updateJob(jobId, {
      files_total: files.length,
      files_unchanged: files.length - changed.length,
      files_removed: removed.length
    });
    log(jobId, `${files.length} indexable files: ${changed.length} new/changed, ${removed.length} removed`);

    const { chunks, emptyFiles } = await buildChunks({ repositoryId: repository.id, files: changed, jobId });
    await repoStore.upsertIndexedFiles(repository.id,
      emptyFiles.map(f => ({ filePath: f.filePath, blobSha: shas.get(f.filePath) || '', chunkCount: 0 })));
    await repoStore.updateJob(jobId, { stage: 'embedding', chunks_total: chunks.length });

    // Record a file in indexed_files only once all of its chunks are stored.
    const remaining = new Map();
    const totals = new Map();
    for (const c of chunks) {
      remaining.set(c.filePath, (remaining.get(c.filePath) || 0) + 1);
      totals.set(c.filePath, (totals.get(c.filePath) || 0) + 1);
    }
    const failedFiles = new Set();

    let done = 0;
    let failed = 0;
    const batchSize = config.ingestion.embedBatchSize;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const result = await embedBatch(batch, jobId);
      await chroma.upsertChunks(result.ok);
      const okIds = new Set(result.ok.map(c => c.chunkId));

      const finishedFiles = [];
      for (const c of batch) {
        if (!okIds.has(c.chunkId)) failedFiles.add(c.filePath);
        const left = remaining.get(c.filePath) - 1;
        remaining.set(c.filePath, left);
        if (left === 0 && !failedFiles.has(c.filePath)) {
          finishedFiles.push({ filePath: c.filePath, blobSha: shas.get(c.filePath) || '', chunkCount: totals.get(c.filePath) });
        }
        c.embedding = null; // free memory
      }
      await repoStore.upsertIndexedFiles(repository.id, finishedFiles);

      done += batch.length;
      failed += result.failed;
      await repoStore.updateJob(jobId, { chunks_done: done, chunks_failed: failed });
    }

    if (chunks.length > 0 && failed === chunks.length) {
      throw new Error('Every chunk failed to embed — check the embedding service configuration.');
    }

    // Code is searchable from here on.
    await repoStore.setRepositoryStatus(repository.id, 'ready', { lastIndexed: new Date(), commitSha: clone.commitSha });
    log(jobId, `code complete: ${done - failed}/${chunks.length} chunks stored`);

    await runHistoryStage({ repository, jobId, token });

    await repoStore.updateJob(jobId, { status: 'complete', stage: 'done', completed_at: new Date() });
    log(jobId, 'job complete');
  } catch (error) {
    const message = redact(error.message, token);
    log(jobId, `FAILED: ${message}`);
    await repoStore
      .updateJob(jobId, { status: 'failed', error_message: message, completed_at: new Date() })
      .catch(e => console.error('[ingestion] could not record failure:', e.message));
    if (repository.index_status !== 'ready') {
      await repoStore.setRepositoryStatus(repository.id, 'failed').catch(() => {});
    }
  } finally {
    cleanup();
  }

  // A webhook push arrived while this job was running: index again to pick it up.
  try {
    if (await repoStore.takePendingReindex(repository.id)) {
      const fresh = await repoStore.getRepository(repository.id);
      log(jobId, 'push arrived during this job; starting follow-up re-index');
      await startIngestion(fresh, { trigger: 'webhook' });
    }
  } catch (error) {
    console.error('[ingestion] follow-up re-index failed to start:', error.message);
  }
}

/**
 * Create an indexing job and run it in the background.
 * Entry point for POST /api/repos, POST /api/repos/:id/reindex and POST /api/webhooks/github.
 * @param {object} repository - repositories row
 * @param {{ trigger?: 'connect'|'reindex'|'webhook', full?: boolean }} [opts]
 * @returns {Promise<object>} the created indexing_jobs row
 */
async function startIngestion(repository, { trigger = 'connect', full = false } = {}) {
  const encrypted = await repoStore.getRepositoryToken(repository.id);
  const token = encrypted ? decrypt(encrypted) : null;
  const job = await repoStore.createJob(repository.id, { trigger, full });
  setImmediate(() => {
    runJob({ repository, job, token }).catch(e => console.error('[ingestion] unexpected error:', e));
  });
  return job;
}

module.exports = { startIngestion, runJob };
