const { query } = require('../../db/postgres');

/** Data access for repositories + indexing_jobs. */

const REPO_COLUMNS = `id, url, name, platform, index_status, last_commit_sha, last_indexed, created_at,
  (encrypted_token IS NOT NULL) AS has_token`;

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

async function getRepositoryToken(id) {
  const { rows } = await query('SELECT encrypted_token FROM repositories WHERE id = $1', [id]);
  return rows[0] ? rows[0].encrypted_token : null;
}

/** All repositories with their latest indexing job (for the repo picker / dashboard). */
async function listRepositories() {
  const { rows } = await query(
    `SELECT r.id, r.url, r.name, r.platform, r.index_status, r.last_commit_sha, r.last_indexed, r.created_at,
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

async function createJob(repositoryId) {
  const { rows } = await query(
    `INSERT INTO indexing_jobs (repository_id, status, stage) VALUES ($1, 'pending', 'queued') RETURNING *`,
    [repositoryId]
  );
  return rows[0];
}

/** Partial update of a job row: updateJob(id, { status, stage, chunks_done, ... }) */
async function updateJob(id, fields) {
  const allowed = ['status', 'stage', 'files_total', 'chunks_total', 'chunks_done', 'chunks_failed', 'error_message', 'completed_at'];
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

module.exports = {
  upsertRepository, getRepository, getRepositoryToken, listRepositories, setRepositoryStatus,
  createJob, updateJob, getLatestJob, getActiveJob, failOrphanedJobs
};
