require('dotenv').config();
const { query } = require('../db/postgres');

async function main() {
  const repoId = 'a067c6f1-af0a-466f-bac8-3ee3c0ad8057';

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 10000));
    const j = await query(
      'SELECT status, stage, files_total, chunks_done, error_message FROM indexing_jobs WHERE repository_id = $1 ORDER BY started_at DESC LIMIT 1',
      [repoId]
    );
    const row = j.rows[0];
    console.log(`[${new Date().toISOString()}] status=${row.status} stage=${row.stage} files=${row.files_total} chunks=${row.chunks_done} err=${row.error_message || 'none'}`);
    if (row.status === 'complete' || row.status === 'failed') {
      const f = await query('SELECT COUNT(*) FROM indexed_files WHERE repository_id = $1', [repoId]);
      console.log('indexed_files count:', f.rows[0].count);
      const md = await query("SELECT file_path FROM indexed_files WHERE repository_id = $1 AND file_path ILIKE '%.md'", [repoId]);
      console.log('.md files:', md.rows.map(r => r.file_path).join(', ') || '(none)');
      process.exit(0);
    }
  }
  console.log('Timed out waiting for job');
  process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
