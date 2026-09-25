const express = require('express');
const router = express.Router();
const repoStore = require('../services/repos/repoStore');
const { startIngestion } = require('../services/ingestion/pipeline');
const { parseGitHubUrl } = require('../services/ingestion/fetchRepo');
const { encrypt } = require('../utils/crypto');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jobView(job) {
  if (!job) return null;
  const total = job.chunks_total || 0;
  return {
    jobId: job.id,
    status: job.status,             // pending | running | complete | failed
    stage: job.stage,               // queued | cloning | parsing | embedding | done
    filesTotal: job.files_total,
    chunksTotal: total,
    chunksDone: job.chunks_done,
    chunksFailed: job.chunks_failed,
    progress: job.status === 'complete' ? 1 : total ? Math.min(1, job.chunks_done / total) : 0,
    error: job.error_message || null,
    startedAt: job.started_at,
    completedAt: job.completed_at
  };
}

function repoView(repo) {
  return {
    id: repo.id,
    url: repo.url,
    name: repo.name,
    platform: repo.platform,
    indexStatus: repo.index_status, // pending | indexing | ready | failed
    hasToken: repo.has_token,
    lastCommitSha: repo.last_commit_sha,
    lastIndexed: repo.last_indexed,
    createdAt: repo.created_at
  };
}

function validId(req, res) {
  if (!UUID_RE.test(req.params.id)) {
    res.status(400).json({ error: 'Invalid repository id.' });
    return false;
  }
  return true;
}

/**
 * POST /api/repos
 * Body: { url: "https://github.com/owner/repo", token?: "ghp_..." }
 * 202 -> { repositoryId, jobId, repository, job }
 * Connecting an already-connected URL re-indexes it (or returns the in-flight job).
 */
router.post('/repos', async (req, res) => {
  const { url, token } = req.body || {};
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: 'Field "url" must be a GitHub repository URL, e.g. https://github.com/owner/repo' });
  }
  if (token !== undefined && (typeof token !== 'string' || !token.trim())) {
    return res.status(400).json({ error: 'Field "token" must be a non-empty string when provided.' });
  }

  try {
    const repository = await repoStore.upsertRepository({
      url: parsed.url,
      name: parsed.name,
      platform: 'github',
      encryptedToken: token ? encrypt(token.trim()) : null
    });

    const active = await repoStore.getActiveJob(repository.id);
    const job = active || (await startIngestion(repository));

    res.status(202).json({
      repositoryId: repository.id,
      jobId: job.id,
      alreadyIndexing: Boolean(active),
      repository: repoView(repository),
      job: jobView(job)
    });
  } catch (error) {
    console.error('[repos] connect failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/repos -> { repositories: [...] } (each with its latest job) */
router.get('/repos', async (req, res) => {
  try {
    const rows = await repoStore.listRepositories();
    res.json({
      repositories: rows.map(r => ({
        ...repoView(r),
        latestJob: r.job_id
          ? { jobId: r.job_id, status: r.job_status, stage: r.stage, chunksDone: r.chunks_done, chunksTotal: r.chunks_total }
          : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/repos/:id -> repository details */
router.get('/repos/:id', async (req, res) => {
  if (!validId(req, res)) return;
  try {
    const repo = await repoStore.getRepository(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    res.json(repoView(repo));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/repos/:id/status  — poll this for the progress bar.
 * -> { repositoryId, indexStatus, status, stage, chunksDone, chunksTotal, progress, error, ... }
 */
router.get('/repos/:id/status', async (req, res) => {
  if (!validId(req, res)) return;
  try {
    const repo = await repoStore.getRepository(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    const job = await repoStore.getLatestJob(repo.id);
    res.json({ repositoryId: repo.id, indexStatus: repo.index_status, ...jobView(job) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/repos/:id/reindex -> 202 { repositoryId, jobId } */
router.post('/repos/:id/reindex', async (req, res) => {
  if (!validId(req, res)) return;
  try {
    const repo = await repoStore.getRepository(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    const active = await repoStore.getActiveJob(repo.id);
    const job = active || (await startIngestion(repo));
    res.status(202).json({ repositoryId: repo.id, jobId: job.id, alreadyIndexing: Boolean(active), job: jobView(job) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
