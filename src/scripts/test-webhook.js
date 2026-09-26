/**
 * Send a correctly signed GitHub "push" webhook to the local server — no GitHub/ngrok needed.
 *
 * Usage: npm run test:webhook -- owner/repo [branch]
 *   The repo must already be connected (POST /api/repos). Branch defaults to "main";
 *   pass the repo's real default branch (e.g. "master") or the push is ignored.
 * Uses PORT and GITHUB_WEBHOOK_SECRET from .env.
 */
require('dotenv').config({ quiet: true });
const crypto = require('crypto');

async function main() {
  const [repoArg, branch = 'main'] = process.argv.slice(2);
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!repoArg) throw new Error('Usage: npm run test:webhook -- owner/repo [branch]');
  if (!secret) throw new Error('GITHUB_WEBHOOK_SECRET is not set in .env');

  const body = JSON.stringify({
    ref: `refs/heads/${branch}`,
    after: 'test',
    repository: { html_url: `https://github.com/${repoArg}`, full_name: repoArg, default_branch: branch }
  });
  const signature = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;
  const url = `http://localhost:${process.env.PORT || 3000}/api/webhooks/github`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'push',
      'X-GitHub-Delivery': `local-test-${Date.now()}`,
      'X-Hub-Signature-256': signature
    },
    body
  });
  console.log(`POST ${url} -> ${res.status}`);
  console.log(await res.text());
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
