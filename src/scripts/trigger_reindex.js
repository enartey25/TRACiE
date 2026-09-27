require('dotenv').config();
const { query } = require('../db/postgres');

async function main() {
  const r = await query("SELECT id, name FROM repositories WHERE name ILIKE '%SES-GPT%'");
  if (!r.rows.length) { console.error('SES-GPT repo not found'); process.exit(1); }
  const repo = r.rows[0];
  console.log('Found repo:', repo.id, repo.name);

  const res = await fetch('http://localhost:3000/api/repos/' + repo.id + '/reindex', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const data = await res.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
