const axios = require('axios');
const userStore = require('../services/users/userStore');

/**
 * Every /api route except the few public ones below needs a signed-in GitHub user.
 * Sets req.user = { id, login, accessToken }.
 *
 * Sessions created before user accounts existed carry the GitHub token but no userId;
 * those are upgraded on first request by looking the profile up once.
 */

const PUBLIC_API_PATHS = [
  /^\/health$/,
  /^\/auth\/status$/,
  /^\/fixtures(\/|$)/,
  /^\/webhooks(\/|$)/
];

async function resolveUser(req) {
  const gh = req.session && req.session.github;
  if (!gh || !gh.accessToken) return null;

  if (!req.session.userId) {
    const { data } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${gh.accessToken}`, 'User-Agent': 'TRACiE-Assistant' },
      timeout: 10000
    });
    const user = await userStore.upsertGithubUser(data);
    req.session.userId = user.id;
  }
  return { id: req.session.userId, login: gh.login, accessToken: gh.accessToken };
}

async function requireUser(req, res, next) {
  if (PUBLIC_API_PATHS.some(re => re.test(req.path))) return next();
  try {
    const user = await resolveUser(req);
    if (!user) {
      return res.status(401).json({
        type: 'alert_card',
        severity: 'warning',
        title: 'Sign in required',
        message: 'Sign in with GitHub to use TRACiE.',
        error: 'unauthenticated'
      });
    }
    req.user = user;
    next();
  } catch (error) {
    // The stored GitHub token was revoked or expired.
    console.warn('[auth] could not resolve user:', error.message);
    req.session.github = null;
    req.session.userId = null;
    res.status(401).json({ error: 'unauthenticated', message: 'Your GitHub session expired. Sign in again.' });
  }
}

/**
 * Route helper: 404s (not 403, so repo ids aren't probeable) unless the signed-in user
 * has the repository linked. Returns the user's role, or null after responding.
 */
async function assertRepoAccess(req, res, repositoryId) {
  const role = await userStore.getRepositoryRole(req.user.id, repositoryId);
  if (role === null) {
    res.status(404).json({ error: 'Repository not found.' });
    return null;
  }
  return role;
}

/** Like assertRepoAccess, for a doc proposal id. Returns the proposal, or null after responding. */
async function assertProposalAccess(req, res, proposalId) {
  const proposal = await require('../services/docs/proposalStore').getProposal(proposalId);
  if (!proposal || (await userStore.getRepositoryRole(req.user.id, proposal.repository_id)) === null) {
    res.status(404).json({ error: 'Proposal not found.' });
    return null;
  }
  return proposal;
}

/**
 * Chat session id for a query. A persisted (UUID) session must belong to the user; any other
 * id only keys in-memory history, so it's namespaced per user to keep contexts separate.
 * @returns {Promise<string|undefined>} the id to use, or throws { status: 404 }
 */
async function scopeSessionId(req, sessionId) {
  if (!sessionId) return undefined;
  const sessionStore = require('../services/sessions/sessionStore');
  if (sessionStore.isUuid(sessionId)) {
    if (!(await sessionStore.getSession(sessionId, req.user.id))) {
      const error = new Error('Session not found.');
      error.status = 404;
      throw error;
    }
    return sessionId;
  }
  return `${req.user.id}:${sessionId}`;
}

module.exports = { requireUser, assertRepoAccess, assertProposalAccess, scopeSessionId };
