const { query } = require('../../db/postgres');

/** Data access for repositories + indexing_jobs. */

const REPO_COLUMNS = `id, url, name, platform, index_status, last_commit_sha, last_indexed, history_indexed_at,
  created_at, (encrypted_token IS NOT NULL) AS has_token`;

async function upsertRepository({ url, name, platform = 'github', encryptedToken }) {
  const { rows } = await query(
    `INSERT INTO repositories (url, name, platform, encrypted_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (url) DO UPDATE
       SET name = EXCLUDED.name,
           encrypted_token = COALESCE(EXCLUDED.encrypted_token, repositories.encrypted_token)
     RETURNING ${REPO_COLUMNS}, (xmax = 0) AS created`,
    [url, name, platform, encryptedToken || null]
  );
  return rows[0];
}

async function getRepository(id) {
  const { rows } = await query(`SELECT ${REPO_COLUMNS} FROM repositories WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Case-insensitive lookup by normalised URL (https://github.com/owner/repo) — used by the webhook. */
async function findRepositoryByUrl(url) {
  const { rows } = await query(`SELECT ${REPO_COLUMNS} FROM repositories WHERE lower(url) = lower($1)`, [url]);
  return rows[0] || null;
}

async function getRepositoryToken(id) {
  const { rows } = await query('SELECT encrypted_token FROM repositories WHERE id = $1', [id]);
  return rows[0] ? rows[0].encrypted_token : null;
}

/** All repositories with their latest indexing job (for the repo picker / dashboard). */
async function listRepositories() {
  const { rows } = await query(
    `SELECT r.id, r.url, r.name, r.platform, r.index_status, r.last_commit_sha, r.last_indexed,
            r.history_indexed_at, r.created_at,
            (r.encrypted_token IS NOT NULL) AS has_token,
            j.id AS job_id, j.status AS job_status, j.stage, j.chunks_done, j.chunks_total
     FROM repositories r
     LEFT JOIN LATERAL (
       SELECT * FROM indexing_jobs WHERE repository_id = r.id ORDER BY started_at DESC LIMIT 1
     ) j ON true
     ORDER BY r.created_at DESC`
  );
  return rows;
}

async function setRepositoryStatus(id, indexStatus, extra = {}) {
  await query(
    `UPDATE repositories
       SET index_status = $2,
           last_indexed = COALESCE($3, last_indexed),
           last_commit_sha = COALESCE($4, last_commit_sha)
     WHERE id = $1`,
    [id, indexStatus, extra.lastIndexed || null, extra.commitSha || null]
  );
}

async function setHistoryIndexed(id) {
  await query('UPDATE repositories SET history_indexed_at = now() WHERE id = $1', [id]);
}

/** Webhook arrived while a job was running: remember to run again when it finishes. */
async function setPendingReindex(id, pending) {
  await query('UPDATE repositories SET pending_reindex = $2 WHERE id = $1', [id, pending]);
}

/** Atomically read-and-clear the pending flag. */
async function takePendingReindex(id) {
  const { rows } = await query(
    `UPDATE repositories SET pending_reindex = false WHERE id = $1 AND pending_reindex RETURNING id`,
    [id]
  );
  return rows.length > 0;
}

/** @param {{ trigger?: 'connect'|'reindex'|'webhook', full?: boolean }} [opts] */
async function createJob(repositoryId, { trigger = 'connect', full = false } = {}) {
  const { rows } = await query(
    `INSERT INTO indexing_jobs (repository_id, status, stage, trigger, full_reindex)
     VALUES ($1, 'pending', 'queued', $2, $3) RETURNING *`,
    [repositoryId, trigger, full]
  );
  return rows[0];
}

/** Partial update of a job row: updateJob(id, { status, stage, chunks_done, ... }) */
async function updateJob(id, fields) {
  const allowed = [
    'status', 'stage', 'files_total', 'files_unchanged', 'files_removed', 'chunks_total', 'chunks_done',
    'chunks_failed', 'error_message', 'completed_at', 'history_status', 'history_chunks', 'history_error'
  ];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (!keys.length) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await query(`UPDATE indexing_jobs SET ${sets} WHERE id = $1`, [id, ...keys.map(k => fields[k])]);
}

async function getLatestJob(repositoryId) {
  const { rows } = await query(
    'SELECT * FROM indexing_jobs WHERE repository_id = $1 ORDER BY started_at DESC LIMIT 1',
    [repositoryId]
  );
  return rows[0] || null;
}

async function getActiveJob(repositoryId) {
  const { rows } = await query(
    `SELECT * FROM indexing_jobs WHERE repository_id = $1 AND status IN ('pending', 'running')
     ORDER BY started_at DESC LIMIT 1`,
    [repositoryId]
  );
  return rows[0] || null;
}

/** On boot: jobs left running by a crashed/restarted server can never finish. */
async function failOrphanedJobs() {
  const { rows } = await query(
    `UPDATE indexing_jobs
       SET status = 'failed', error_message = 'Server restarted during indexing', completed_at = now()
     WHERE status IN ('pending', 'running')
     RETURNING repository_id`
  );
  if (rows.length) {
    await query(
      `UPDATE repositories SET index_status = 'failed' WHERE id = ANY($1::uuid[]) AND index_status = 'indexing'`,
      [rows.map(r => r.repository_id)]
    );
  }
  return rows.length;
}

// ---- indexed_files: per-file blob SHAs for incremental re-indexing ----

/** @returns {Promise<Map<string, string>>} file_path -> blob_sha */
async function getIndexedFiles(repositoryId) {
  const { rows } = await query('SELECT file_path, blob_sha FROM indexed_files WHERE repository_id = $1', [repositoryId]);
  return new Map(rows.map(r => [r.file_path, r.blob_sha]));
}

/** @param {Array<{ filePath, blobSha, chunkCount }>} files */
async function upsertIndexedFiles(repositoryId, files) {
  if (!files.length) return;
  await query(
    `INSERT INTO indexed_files (repository_id, file_path, blob_sha, chunk_count)
     SELECT $1, f.file_path, f.blob_sha, f.chunk_count
     FROM jsonb_to_recordset($2::jsonb) AS f(file_path TEXT, blob_sha TEXT, chunk_count INTEGER)
     ON CONFLICT (repository_id, file_path) DO UPDATE
       SET blob_sha = EXCLUDED.blob_sha, chunk_count = EXCLUDED.chunk_count, indexed_at = now()`,
    [repositoryId, JSON.stringify(files.map(f => ({ file_path: f.filePath, blob_sha: f.blobSha, chunk_count: f.chunkCount })))]
  );
}

/** Delete tracking rows for the given paths, or for the whole repository when paths is omitted. */
async function deleteIndexedFiles(repositoryId, filePaths) {
  if (!filePaths) {
    await query('DELETE FROM indexed_files WHERE repository_id = $1', [repositoryId]);
  } else if (filePaths.length) {
    await query('DELETE FROM indexed_files WHERE repository_id = $1 AND file_path = ANY($2::text[])', [repositoryId, filePaths]);
  }
}

module.exports = {
  upsertRepository, getRepository, findRepositoryByUrl, getRepositoryToken, listRepositories, setRepositoryStatus,
  setHistoryIndexed, setPendingReindex, takePendingReindex,
  createJob, updateJob, getLatestJob, getActiveJob, failOrphanedJobs,
  getIndexedFiles, upsertIndexedFiles, deleteIndexedFiles
};
