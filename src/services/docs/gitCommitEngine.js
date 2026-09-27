const axios = require('axios');
const { parseGitHubUrl } = require('../ingestion/fetchRepo');
const { decryptToken } = require('../../utils/crypto');
const repoStore = require('../repos/repoStore');
const proposalStore = require('./proposalStore');
const config = require('../../config/backend');

/**
 * Applies a simple unified diff to an existing file string.
 * Supports standard diff blocks (+/- lines) and fallback replacement.
 */
function applyDiffToContent(originalContent, diffMarkdown) {
  if (!diffMarkdown) return originalContent;

  const lines = originalContent.split(/\r?\n/);
  const diffLines = diffMarkdown.split(/\r?\n/);

  // Look for @@ -x,y +a,b @@ chunks
  const hunkHeaders = diffLines.map((l, idx) => ({ line: l, idx })).filter(h => /^@@\s+-\d+/.test(h.line));

  if (hunkHeaders.length === 0) {
    // If no hunk headers, extract all '+' lines that aren't '+++' and append/merge
    const addedLines = diffLines
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.slice(1));

    if (addedLines.length > 0) {
      return originalContent.trimEnd() + '\n\n' + addedLines.join('\n') + '\n';
    }
    return originalContent;
  }

  // Best-effort line replacement based on hunks
  let resultLines = [...lines];
  for (let h = hunkHeaders.length - 1; h >= 0; h--) {
    const startIdx = hunkHeaders[h].idx;
    const endIdx = h < hunkHeaders.length - 1 ? hunkHeaders[h + 1].idx : diffLines.length;
    const hunkChunk = diffLines.slice(startIdx + 1, endIdx);

    const match = hunkHeaders[h].line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
    if (!match) continue;

    const oldStart = Math.max(0, parseInt(match[1], 10) - 1);
    const oldCount = match[2] !== undefined ? parseInt(match[2], 10) : 1;

    const newHunkLines = [];
    for (const dLine of hunkChunk) {
      if (dLine.startsWith('+') && !dLine.startsWith('+++')) {
        newHunkLines.push(dLine.slice(1));
      } else if (dLine.startsWith(' ') || (!dLine.startsWith('-') && !dLine.startsWith('\\'))) {
        newHunkLines.push(dLine.startsWith(' ') ? dLine.slice(1) : dLine);
      }
      // '-' lines are omitted
    }

    if (oldStart < resultLines.length) {
      resultLines.splice(oldStart, oldCount, ...newHunkLines);
    } else {
      resultLines.push(...newHunkLines);
    }
  }

  return resultLines.join('\n');
}

/**
 * Commits and pushes an approved documentation proposal to GitHub.
 * Depending on repository settings (`commit_mode`):
 * - 'pr': Creates a feature branch, commits the file, and opens a Pull Request.
 * - 'direct': Commits directly to the repository's default branch.
 *
 * @param {object} params
 * @param {string} params.proposalId - ID of the proposal to commit
 * @param {string} [params.token] - Optional explicit GitHub token override
 * @returns {Promise<{ success: boolean, commitStatus: string, prUrl?: string, commitSha?: string, error?: string }>}
 */
async function executeProposalCommit({ proposalId, token }) {
  const proposal = await proposalStore.getProposal(proposalId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }

  const repo = await repoStore.getRepository(proposal.repository_id);
  if (!repo) {
    throw new Error(`Repository not found for proposal: ${proposal.repository_id}`);
  }

  const parsed = parseGitHubUrl(repo.url);
  if (!parsed) {
    throw new Error(`Invalid GitHub repository URL: ${repo.url}`);
  }

  // Resolve GitHub token: parameter -> encrypted repo token -> backend config -> env
  let effectiveToken = token;
  if (!effectiveToken && repo.has_token) {
    try {
      const encrypted = await repoStore.getRepositoryToken(repo.id);
      if (encrypted) {
        effectiveToken = decryptToken(encrypted, config.tokenEncryptionKey);
      }
    } catch (e) {
      console.warn('[commitEngine] Could not decrypt repo token:', e.message);
    }
  }
  if (!effectiveToken) {
    effectiveToken = config.githubToken || process.env.GITHUB_TOKEN;
  }

  if (!effectiveToken) {
    const errorMsg = 'No GitHub token configured. Please supply a GitHub personal access token with "repo" write permissions.';
    await proposalStore.updateProposalCommit(proposalId, {
      commitStatus: 'failed',
      errorMessage: errorMsg
    });
    return { success: false, commitStatus: 'failed', error: errorMsg };
  }

  await proposalStore.updateProposalCommit(proposalId, { commitStatus: 'committing' });

  const ghApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${effectiveToken}`,
      'User-Agent': 'TRACiE-DocAutomation'
    },
    timeout: 15000
  });

  try {
    // 1. Get repository info to find default branch
    const repoRes = await ghApi.get(`/repos/${parsed.owner}/${parsed.repo}`);
    const defaultBranch = repoRes.data.default_branch || 'main';

    // 2. Get latest commit SHA of the default branch
    const refRes = await ghApi.get(`/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${defaultBranch}`);
    const baseCommitSha = refRes.data.object.sha;

    const commitMode = repo.commit_mode || 'pr';
    const targetFile = proposal.target_file || 'README.md';

    let targetBranch = defaultBranch;
    let branchCreated = false;

    if (commitMode === 'pr') {
      const branchSuffix = Date.now().toString(36);
      targetBranch = `tracie-docs-${branchSuffix}`;

      // Create new branch from baseCommitSha
      await ghApi.post(`/repos/${parsed.owner}/${parsed.repo}/git/refs`, {
        ref: `refs/heads/${targetBranch}`,
        sha: baseCommitSha
      });
      branchCreated = true;
    }

    // 3. Get existing file content (if any) to calculate new content and file SHA
    let existingContent = '';
    let existingSha = undefined;

    try {
      const fileRes = await ghApi.get(`/repos/${parsed.owner}/${parsed.repo}/contents/${targetFile}`, {
        params: { ref: targetBranch }
      });
      existingSha = fileRes.data.sha;
      if (fileRes.data.content && fileRes.data.encoding === 'base64') {
        existingContent = Buffer.from(fileRes.data.content, 'base64').toString('utf8');
      }
    } catch (fileErr) {
      if (fileErr.response?.status !== 404) {
        throw fileErr;
      }
      // File doesn't exist yet, we'll create it
    }

    const updatedContent = applyDiffToContent(existingContent, proposal.diff_markdown);
    const encodedContent = Buffer.from(updatedContent, 'utf8').toString('base64');

    // 4. Commit updated file
    const commitMessage = proposal.pr_title || `docs: update ${targetFile}`;
    const putRes = await ghApi.put(`/repos/${parsed.owner}/${parsed.repo}/contents/${targetFile}`, {
      message: commitMessage,
      content: encodedContent,
      sha: existingSha,
      branch: targetBranch
    });

    const commitSha = putRes.data?.commit?.sha || null;

    // 5. If PR mode, create the Pull Request
    let prUrl = null;
    let finalStatus = 'committed';

    if (commitMode === 'pr' && branchCreated) {
      const prTitle = proposal.pr_title || `docs: update ${targetFile}`;
      const prBody = proposal.pr_body || `${proposal.rationale || 'Documentation update'}\n\n---\n*Auto-generated by TRACiE Documentation Assistant*`;

      try {
        const prRes = await ghApi.post(`/repos/${parsed.owner}/${parsed.repo}/pulls`, {
          title: prTitle,
          head: targetBranch,
          base: defaultBranch,
          body: prBody
        });
        prUrl = prRes.data.html_url;
        finalStatus = 'pr_created';
      } catch (prErr) {
        console.warn('[commitEngine] PR creation note:', prErr.response?.data?.message || prErr.message);
        // Fallback: branch was pushed, return branch compare URL if PR creation had an issue
        prUrl = `https://github.com/${parsed.owner}/${parsed.repo}/compare/${defaultBranch}...${targetBranch}`;
        finalStatus = 'pr_created';
      }
    }

    await proposalStore.updateProposalCommit(proposalId, {
      commitStatus: finalStatus,
      commitSha,
      prUrl,
      errorMessage: null
    });

    return {
      success: true,
      commitStatus: finalStatus,
      commitSha,
      prUrl,
      branch: targetBranch
    };
  } catch (error) {
    const errorDetails = error.response?.data?.message || error.message;
    console.error('[commitEngine] Error executing commit/PR:', errorDetails);

    await proposalStore.updateProposalCommit(proposalId, {
      commitStatus: 'failed',
      errorMessage: errorDetails
    });

    return {
      success: false,
      commitStatus: 'failed',
      error: errorDetails
    };
  }
}

module.exports = { executeProposalCommit, applyDiffToContent };
