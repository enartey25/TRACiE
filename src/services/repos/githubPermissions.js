const axios = require('axios');
const { parseGitHubUrl } = require('../ingestion/fetchRepo');
const config = require('../../config/backend');

/**
 * Checks GitHub repository collaborator/owner permissions using GitHub REST API.
 *
 * @param {object} params
 * @param {string} params.url - Repository URL
 * @param {string} [params.token] - Personal access token (or repo-specific token)
 * @returns {Promise<{ canDetermine: boolean, userRole: 'owner'|'contributor'|'reader'|'unknown', canCommit: boolean, permissions?: object, error?: string }>}
 */
async function checkGitHubPermissions({ url, token }) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    return { canDetermine: false, userRole: 'unknown', canCommit: false, error: 'Invalid GitHub repository URL' };
  }

  const effectiveToken = token || config.githubToken || process.env.GITHUB_TOKEN;

  if (!effectiveToken) {
    // Without a token, GitHub API returns public repository info without caller-specific permissions
    return {
      canDetermine: false,
      userRole: 'unknown',
      canCommit: false,
      owner: parsed.owner,
      repo: parsed.repo,
      message: 'No GitHub token available to auto-verify write access'
    };
  }

  try {
    const res = await axios.get(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${effectiveToken}`,
        'User-Agent': 'TRACiE-Assistant'
      },
      timeout: 10000
    });

    const perms = res.data && res.data.permissions;
    if (perms) {
      if (perms.admin) {
        return {
          canDetermine: true,
          userRole: 'owner',
          canCommit: true,
          permissions: perms,
          owner: parsed.owner,
          repo: parsed.repo
        };
      }
      if (perms.push || perms.maintain) {
        return {
          canDetermine: true,
          userRole: 'contributor',
          canCommit: true,
          permissions: perms,
          owner: parsed.owner,
          repo: parsed.repo
        };
      }
      return {
        canDetermine: true,
        userRole: 'reader',
        canCommit: false,
        permissions: perms,
        owner: parsed.owner,
        repo: parsed.repo
      };
    }

    return {
      canDetermine: false,
      userRole: 'unknown',
      canCommit: false,
      owner: parsed.owner,
      repo: parsed.repo
    };
  } catch (error) {
    return {
      canDetermine: false,
      userRole: 'unknown',
      canCommit: false,
      owner: parsed.owner,
      repo: parsed.repo,
      error: error.response?.data?.message || error.message
    };
  }
}

module.exports = { checkGitHubPermissions };
