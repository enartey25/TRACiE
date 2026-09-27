const express = require('express');
const router = express.Router();
const repoStore = require('../services/repos/repoStore');
const { startIngestion } = require('../services/ingestion/pipeline');
const { parseGitHubUrl } = require('../services/ingestion/fetchRepo');
const { encrypt } = require('../utils/crypto');
const userStore = require('../services/users/userStore');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jobView(job) {
  if (!job) return null;
  const total = job.chunks_total || 0;
  return {
    jobId: job.id,
    trigger: job.trigger,           // connect | reindex | webhook
    fullReindex: job.full_reindex,
    status: job.status,             // pending | running | complete | failed
    stage: job.stage,               // queued | cloning | parsing | embedding | history | done
    filesTotal: job.files_total,
    filesUnchanged: job.files_unchanged,
    filesRemoved: job.files_removed,
    chunksTotal: total,
    chunksDone: job.chunks_done,
    chunksFailed: job.chunks_failed,
    progress: job.status === 'complete' ? 1 : total ? Math.min(1, job.chunks_done / total) : 0,
    history: { status: job.history_status || null, chunks: job.history_chunks || 0, error: job.history_error || null },
    error: job.error_message || null,
    startedAt: job.started_at,
    completedAt: job.completed_at
  };
}

const { checkGitHubPermissions } = require('../services/repos/githubPermissions');
const { scanAndResolveInconsistencies } = require('../services/docs/docConsistencyChecker');

function repoView(repo) {
  return {
    id: repo.id,
    url: repo.url,
    name: repo.name,
    platform: repo.platform,
    indexStatus: repo.index_status, // pending | indexing | ready | failed
    hasToken: repo.has_token,
    userRole: repo.user_role || 'unknown',
    autoCommit: Boolean(repo.auto_commit),
    commitMode: repo.commit_mode || 'pr',
    pushBranch: repo.push_branch || 'tracie-docs-update',
    lastCommitSha: repo.last_commit_sha,
    lastIndexed: repo.last_indexed,
    historyIndexedAt: repo.history_indexed_at || null,
    createdAt: repo.created_at
  };
}

/**
 * Every /repos/:id route: validate the id, 404 unless the signed-in user has the repository
 * linked, and load it into req.repo with the user's own role applied.
 */
router.param('id', async (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid repository id.' });
  try {
    const role = await userStore.getRepositoryRole(req.user.id, id);
    const repo = role === null ? null : await repoStore.getRepository(id);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    req.repo = { ...repo, user_role: role };
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repos
 * Body: { url: "https://github.com/owner/repo", token?: "ghp_...", userRole?: "owner"|"contributor"|"reader" }
 * 202 -> { repositoryId, jobId, repository, job, permissions, needsRolePrompt }
 */
router.post('/repos', async (req, res) => {
  const { url, token: bodyToken, userRole } = req.body || {};
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return res.status(400).json({ error: 'Field "url" must be a GitHub repository URL, e.g. https://github.com/owner/repo' });
  }
  if (bodyToken !== undefined && (typeof bodyToken !== 'string' || !bodyToken.trim())) {
    return res.status(400).json({ error: 'Field "token" must be a non-empty string when provided.' });
  }

  // Token resolution: OAuth session → explicit body token
  const sessionToken = req.session && req.session.github && req.session.github.accessToken;
  const token = sessionToken || (bodyToken ? bodyToken.trim() : null);

  try {
    // 1. Check Git / GitHub API permissions
    const permResult = await checkGitHubPermissions({ url: parsed.url, token });
    const resolvedRole = userRole || (permResult.canDetermine ? permResult.userRole : 'unknown');
    const needsRolePrompt = !userRole && !permResult.canDetermine;

    const repository = await repoStore.upsertRepository({
      url: parsed.url,
      name: parsed.name,
      platform: 'github',
      encryptedToken: token ? encrypt(token) : null,
      userRole: resolvedRole
    });
    await userStore.linkRepository(req.user.id, repository.id, resolvedRole);
    repository.user_role = (await userStore.getRepositoryRole(req.user.id, repository.id)) || resolvedRole;

    // Start indexing unless a job is already actively running/pending.
    // Previously a failed/orphaned last job would block re-indexing on reconnect.
    // A repository another user already indexed is linked as-is; only new or failed ones are (re)indexed.
    const active = await repoStore.getActiveJob(repository.id);
    const job = active
      || (repository.index_status === 'ready' ? await repoStore.getLatestJob(repository.id) : null)
      || (await startIngestion(repository, { trigger: repository.created ? 'connect' : 'reindex' }));

    res.status(202).json({
      repositoryId: repository.id,
      jobId: job.id,
      alreadyIndexing: Boolean(active),
      alreadyIndexed: !active && repository.index_status === 'ready',
      repository: repoView(repository),
      job: jobView(job),
      permissions: permResult,
      needsRolePrompt
    });
  } catch (error) {
    console.error('[repos] connect failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/repos -> { repositories: [...] } (each with its latest job) */
router.get('/repos', async (req, res) => {
  try {
    const rows = await repoStore.listRepositories(req.user.id);
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
  try {
    const repo = req.repo;
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
  try {
    const repo = req.repo;
    const job = await repoStore.getLatestJob(repo.id);
    res.json({ repositoryId: repo.id, indexStatus: repo.index_status, ...jobView(job) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/repos/:id/reindex  body (optional): { full: true }
 * Incremental by default (only changed files re-embedded); full=true wipes and rebuilds.
 * -> 202 { repositoryId, jobId, alreadyIndexing, job }
 */
router.post('/repos/:id/reindex', async (req, res) => {
  try {
    const repo = req.repo;
    const active = await repoStore.getActiveJob(repo.id);
    const full = Boolean(req.body && req.body.full === true);
    const job = active || (await startIngestion(repo, { trigger: 'reindex', full }));
    res.status(202).json({ repositoryId: repo.id, jobId: job.id, alreadyIndexing: Boolean(active), job: jobView(job) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/repos/:id/settings
 * Body: { userRole?, autoCommit?, commitMode?, pushBranch? }
 * -> 200 updated repository
 */
router.patch('/repos/:id/settings', async (req, res) => {
  try {
    const repo = req.repo;

    const { userRole, autoCommit, commitMode, pushBranch } = req.body || {};
    if (userRole !== undefined && !['owner', 'contributor', 'reader', 'unknown'].includes(userRole)) {
      return res.status(400).json({ error: 'Field "userRole" must be owner, contributor, reader or unknown.' });
    }
    if (commitMode !== undefined && !['pr', 'direct'].includes(commitMode)) {
      return res.status(400).json({ error: 'Field "commitMode" must be "pr" or "direct".' });
    }
    // The role is per user; commit automation is a property of the shared repository.
    if (userRole !== undefined) await userStore.setRepositoryRole(req.user.id, repo.id, userRole);
    const updated = await repoStore.updateRepositorySettings(repo.id, { autoCommit, commitMode, pushBranch });
    res.json(repoView({ ...updated, user_role: userRole !== undefined ? userRole : repo.user_role }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/repos/:id/permissions
 * Re-probes GitHub permissions for the repository.
 */
router.get('/repos/:id/permissions', async (req, res) => {
  try {
    const repo = req.repo;
    // Prefer OAuth session token for most accurate role detection
    const permResult = await checkGitHubPermissions({ url: repo.url, token: req.user.accessToken });
    res.json(permResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/repos/:id/scan-docs
 * Triggers documentation inconsistency detection across indexed code chunks and documentation files.
 * Body (optional): { autoCommit?: boolean }
 */
router.post('/repos/:id/scan-docs', async (req, res) => {
  try {
    const repo = req.repo;

    const autoCommitOverride = req.body && typeof req.body.autoCommit === 'boolean' ? req.body.autoCommit : undefined;
    const result = await scanAndResolveInconsistencies({
      repositoryId: repo.id,
      autoCommitOverride
    });

    res.json({
      status: 'success',
      repositoryId: repo.id,
      repositoryName: repo.name,
      scannedFiles: result.scannedFiles,
      inconsistenciesFound: result.inconsistenciesFound,
      proposals: result.proposals
    });
  } catch (error) {
    console.error('[scan-docs] Inconsistency check failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/repos/:id — removes the repository from the signed-in user's account.
 * The shared index is kept for other users who connected the same repository.
 */
router.delete('/repos/:id', async (req, res) => {
  try {
    await userStore.unlinkRepository(req.user.id, req.repo.id);
    res.json({ status: 'ok', repositoryId: req.repo.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
