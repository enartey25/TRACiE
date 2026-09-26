const crypto = require('crypto');
const express = require('express');
const config = require('../config/backend');
const repoStore = require('../services/repos/repoStore');
const { startIngestion } = require('../services/ingestion/pipeline');
const { parseGitHubUrl } = require('../services/ingestion/fetchRepo');

/**
 * POST /api/webhooks/github — push-triggered re-indexing.
 *
 * GitHub setup (repo -> Settings -> Webhooks -> Add webhook):
 *   Payload URL:  https://<public-host>/api/webhooks/github   (use ngrok for a local server)
 *   Content type: application/json
 *   Secret:       same value as GITHUB_WEBHOOK_SECRET
 *   Events:       "Just the push event"
 *
 * Mounted in server.js BEFORE express.json(), because the HMAC must be computed
 * over the exact raw bytes GitHub sent.
 */
const router = express.Router();

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(signatureHeader);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

router.post('/github', express.raw({ type: '*/*', limit: '25mb' }), async (req, res) => {
  const event = req.get('X-GitHub-Event');
  const delivery = req.get('X-GitHub-Delivery') || 'unknown';

  if (!config.githubWebhookSecret) {
    return res.status(503).json({ error: 'GITHUB_WEBHOOK_SECRET is not configured on this server.' });
  }
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!verifySignature(rawBody, req.get('X-Hub-Signature-256'), config.githubWebhookSecret)) {
    console.warn(`[webhook] rejected delivery ${delivery}: bad or missing signature`);
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (_) {
    return res.status(400).json({ error: 'Payload must be JSON (set the webhook content type to application/json).' });
  }

  if (event === 'ping') {
    return res.json({ ok: true, message: 'pong', hookId: payload.hook_id || null });
  }
  if (event !== 'push') {
    return res.status(202).json({ ok: true, ignored: `event '${event}' is not handled` });
  }

  const repoInfo = payload.repository || {};
  const parsed = parseGitHubUrl(repoInfo.html_url || repoInfo.full_name || '');
  if (!parsed) return res.status(400).json({ error: 'Push payload has no recognisable repository.' });

  const defaultBranch = repoInfo.default_branch || repoInfo.master_branch;
  if (payload.deleted || (defaultBranch && payload.ref !== `refs/heads/${defaultBranch}`)) {
    return res.status(202).json({ ok: true, ignored: `push to ${payload.ref} (only ${defaultBranch} is indexed)` });
  }

  try {
    const repository = await repoStore.findRepositoryByUrl(parsed.url);
    if (!repository) {
      return res.status(202).json({ ok: true, ignored: `${parsed.name} is not connected to TRACiE` });
    }

    const active = await repoStore.getActiveJob(repository.id);
    if (active) {
      // Don't lose this push: the running job will start a follow-up re-index when it finishes.
      await repoStore.setPendingReindex(repository.id, true);
      console.log(`[webhook] ${delivery}: ${parsed.name} busy, queued follow-up re-index`);
      return res.status(202).json({ ok: true, repositoryId: repository.id, jobId: active.id, queued: true });
    }

    const job = await startIngestion(repository, { trigger: 'webhook' });
    console.log(`[webhook] ${delivery}: push to ${parsed.name} (${String(payload.after).slice(0, 7)}) -> job ${job.id}`);
    return res.status(202).json({ ok: true, repositoryId: repository.id, jobId: job.id, queued: false });
  } catch (error) {
    console.error('[webhook] failed:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
