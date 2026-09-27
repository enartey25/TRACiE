require('dotenv').config();
const https = require('https');

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const owner = 'enartey25';
const repo = 'TRACiE';
const branch = 'feat/ui-renderer';

function ghGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'TRACiE-fetch',
        'Accept': 'application/vnd.github.v3+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };
    https.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  // List top-level tree
  const branchInfo = await ghGet(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`);
  if (branchInfo.message) { console.error('Branch error:', branchInfo.message); process.exit(1); }
  const sha = branchInfo.commit.sha;
  console.log('Branch SHA:', sha);

  const tree = await ghGet(`/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`);
  const files = tree.tree.filter(f => f.type === 'blob');
  console.log('\nFiles on feat/ui-renderer:');
  files.forEach(f => console.log(' ', f.path));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
