const axios = require('axios');
const config = require('../../config/backend');
const chroma = require('../../db/chroma');
const { embedTexts } = require('./embedder');

/**
 * Git history ingestion: commit messages + pull request descriptions -> ChromaDB.
 *
 * Stored in the same `code_chunks` collection, distinguished by metadata:
 *   chunk_type: 'commit'        + commit_sha, author, committed_at, url
 *   chunk_type: 'pull_request'  + pr_number, pr_state, pr_merged, author, updated_at, url
 * Retrieval can filter with queryChunks({ chunkTypes: ['commit', 'pull_request'] }).
 *
 * Incremental: commits are immutable, so already-stored commits are skipped;
 * PRs are re-embedded only when their updated_at changed.
 */

const GITHUB_API = 'https://api.github.com';

function github(token) {
  return axios.create({
    baseURL: GITHUB_API,
    timeout: 20000,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'TRACiE-ingestion',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
}

async function fetchPaged(client, path, params, max) {
  const items = [];
  for (let page = 1; items.length < max; page++) {
    const { data } = await client.get(path, { params: { ...params, per_page: 100, page } });
    if (!Array.isArray(data) || data.length === 0) break;
    items.push(...data);
    if (data.length < 100) break;
  }
  return items.slice(0, max);
}

/** Split long text into pieces under maxChars, on line boundaries where possible. */
function splitText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const parts = [];
  let current = '';
  for (const line of text.split('\n')) {
    const piece = line.length > maxChars ? line.slice(0, maxChars) : line;
    if (current && current.length + piece.length + 1 > maxChars) {
      parts.push(current);
      current = '';
    }
    current = current ? `${current}\n${piece}` : piece;
  }
  if (current) parts.push(current);
  return parts;
}

function commitChunks(repositoryId, commits, maxChars) {
  return commits.map((c) => {
    const author = (c.author && c.author.login) || (c.commit.author && c.commit.author.name) || 'unknown';
    const date = (c.commit.author && c.commit.author.date) || '';
    const header = `Commit ${c.sha.slice(0, 7)} by ${author} on ${date.slice(0, 10)}`;
    return {
      chunkId: `${repositoryId}_commit_${c.sha}`,
      repositoryId,
      chunkType: 'commit',
      language: 'git',
      moduleName: '',
      text: `${header}\n\n${c.commit.message}`.slice(0, maxChars),
      extra: { commit_sha: c.sha, author, committed_at: date, url: c.html_url || '' }
    };
  });
}

function pullRequestChunks(repositoryId, pr, maxChars) {
  const author = (pr.user && pr.user.login) || 'unknown';
  const state = pr.merged_at ? 'merged' : pr.state;
  const header = `Pull request #${pr.number}: ${pr.title}\nState: ${state}; author: ${author}; opened ${String(pr.created_at).slice(0, 10)}`;
  const body = (pr.body || '(no description)').replace(/\r\n/g, '\n');
  const parts = splitText(body, Math.max(200, maxChars - header.length - 20));
  return parts.map((part, i) => ({
    chunkId: `${repositoryId}_pr_${pr.number}_${i}`,
    repositoryId,
    chunkType: 'pull_request',
    language: 'markdown',
    moduleName: '',
    text: `${header}${parts.length > 1 ? ` (part ${i + 1}/${parts.length})` : ''}\n\n${part}`,
    extra: {
      pr_number: pr.number, pr_state: state, pr_merged: Boolean(pr.merged_at), author,
      updated_at: pr.updated_at, url: pr.html_url || ''
    }
  }));
}

async function embedAndStore(chunks, log) {
  let stored = 0;
  const batchSize = config.ingestion.embedBatchSize;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    try {
      const vectors = await embedTexts(batch.map(c => c.text));
      batch.forEach((c, j) => { c.embedding = vectors[j]; });
      await chroma.upsertChunks(batch);
      stored += batch.length;
    } catch (error) {
      log(`history batch failed, skipping ${batch.length} items: ${error.message}`);
    }
  }
  return stored;
}

/**
 * Ingest commit history + PR descriptions for a GitHub repository.
 * @returns {Promise<{ commits: number, pullRequests: number, chunksStored: number }>}
 */
async function ingestHistory({ repositoryId, owner, repo, token, log = () => {} }) {
  const client = github(token || config.githubToken);
  const { maxChunkChars } = config.ingestion;
  const { maxCommits, maxPullRequests } = config.history;

  const commits = await fetchPaged(client, `/repos/${owner}/${repo}/commits`, {}, maxCommits);
  const pulls = await fetchPaged(client, `/repos/${owner}/${repo}/pulls`, { state: 'all', sort: 'updated', direction: 'desc' }, maxPullRequests);
  log(`history: fetched ${commits.length} commits, ${pulls.length} pull requests`);

  // Commits: skip ones already stored.
  const allCommitChunks = commitChunks(repositoryId, commits, maxChunkChars);
  const existingCommits = await chroma.getExisting(allCommitChunks.map(c => c.chunkId));
  const newCommitChunks = allCommitChunks.filter(c => !existingCommits.has(c.chunkId));

  // PRs: re-embed only when updated_at changed (part 0 carries it).
  const existingPrs = await chroma.getExisting(pulls.map(pr => `${repositoryId}_pr_${pr.number}_0`));
  const changedPulls = pulls.filter((pr) => {
    const meta = existingPrs.get(`${repositoryId}_pr_${pr.number}_0`);
    return !meta || meta.updated_at !== pr.updated_at;
  });
  for (const pr of changedPulls) {
    if (existingPrs.has(`${repositoryId}_pr_${pr.number}_0`)) {
      await chroma.deleteWhere(repositoryId, { pr_number: pr.number }); // drop stale parts
    }
  }
  const prChunks = changedPulls.flatMap(pr => pullRequestChunks(repositoryId, pr, maxChunkChars));

  const toStore = [...newCommitChunks, ...prChunks];
  log(`history: ${newCommitChunks.length} new commits, ${changedPulls.length} new/updated PRs -> ${toStore.length} chunks`);
  const chunksStored = await embedAndStore(toStore, log);
  return { commits: commits.length, pullRequests: pulls.length, chunksStored };
}

/** Turn axios/GitHub errors into a readable message (rate limits are the common case). */
function describeGitHubError(error) {
  const res = error.response;
  if (!res) return error.message;
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers && res.headers['x-ratelimit-reset'];
    const when = reset ? ` (resets ${new Date(Number(reset) * 1000).toISOString()})` : '';
    return `GitHub API rate limit or permission error ${res.status}${when}. Set GITHUB_TOKEN to raise the limit.`;
  }
  if (res.status === 404) return 'GitHub API returned 404 (private repo without a token, or repo not found).';
  return `GitHub API error ${res.status}: ${(res.data && res.data.message) || error.message}`;
}

module.exports = { ingestHistory, describeGitHubError };
