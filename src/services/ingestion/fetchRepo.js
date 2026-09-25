const fs = require('fs');
const os = require('os');
const path = require('path');
const { simpleGit } = require('simple-git');
const config = require('../../config/backend');

/**
 * Parse and normalise a GitHub URL.
 * Accepts https://github.com/owner/repo(.git), git@github.com:owner/repo.git, or owner/repo.
 * @returns {{ owner, repo, name, url }} or null if not a GitHub repo reference.
 */
function parseGitHubUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  const match =
    trimmed.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?(?:[#?].*)?$/i) ||
    trimmed.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i) ||
    trimmed.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) return null;
  const [, owner, repo] = match;
  return { owner, repo, name: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
}

function workRoot() {
  return config.ingestion.workDir || path.join(os.tmpdir(), 'tracie-repos');
}

/** Strip credentials out of any string (git errors echo the remote URL). */
function redact(message, token) {
  let out = String(message || '').replace(/https:\/\/[^@\s]+@/g, 'https://***@');
  if (token) out = out.split(token).join('***');
  return out;
}

/**
 * Shallow-clone a GitHub repository into a temp directory.
 * @returns {Promise<{ dir, commitSha, cleanup }>}
 */
async function cloneRepository({ url, token, jobId }) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error(`Not a GitHub repository URL: ${url}`);

  const dir = path.join(workRoot(), jobId);
  fs.mkdirSync(workRoot(), { recursive: true });
  fs.rmSync(dir, { recursive: true, force: true });

  const authToken = token || config.githubToken;
  const remote = authToken
    ? `https://x-access-token:${authToken}@github.com/${parsed.owner}/${parsed.repo}.git`
    : `${parsed.url}.git`;

  // GIT_TERMINAL_PROMPT=0: fail fast on private repos instead of hanging on a credential prompt.
  // simple-git v4 rejects env containing EDITOR/PAGER/GIT_* overrides, so pass a filtered copy.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(EDITOR|VISUAL|PAGER|GIT_.*)$/i.test(k))
  );
  const git = simpleGit({ timeout: { block: 120000 }, allowEnvironment: ['GIT_TERMINAL_PROMPT'] }).env({ ...env, GIT_TERMINAL_PROMPT: '0' });
  try {
    await git.clone(remote, dir, ['--depth', '1', '--single-branch', '--no-tags']);
  } catch (error) {
    throw new Error(`git clone failed: ${redact(error.message, authToken)}`);
  }

  let commitSha = null;
  try {
    commitSha = (await simpleGit(dir).revparse(['HEAD'])).trim();
  } catch (_) { /* non-fatal */ }

  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    } catch (error) {
      console.warn(`[ingestion] could not remove ${dir}: ${error.message}`);
    }
  };

  return { dir, commitSha, cleanup };
}

module.exports = { parseGitHubUrl, cloneRepository, redact };
