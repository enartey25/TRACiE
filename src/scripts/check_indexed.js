require('dotenv').config();
const { query } = require('../db/postgres');

async function main() {
  const r = await query('SELECT id, name FROM repositories');
  for (const repo of r.rows) {
    const f = await query('SELECT file_path FROM indexed_files WHERE repository_id = $1', [repo.id]);
    const mdFiles = f.rows.map(x => x.file_path).filter(p => /\.md$/i.test(p));
    console.log(`\n=== ${repo.name} (${repo.id.slice(0,8)}) ===`);
    console.log(`Total indexed: ${f.rows.length}, .md files: ${mdFiles.length}`);
    mdFiles.forEach(p => console.log('  ', p));
    if (mdFiles.length === 0 && f.rows.length > 0) {
      console.log('  (sample files):', f.rows.slice(0,5).map(x=>x.file_path).join(', '));
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
