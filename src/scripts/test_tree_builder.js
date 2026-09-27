const { query } = require('../db/postgres');

async function test() {
  const repoId = '79d34841-187c-426b-b550-e5e74476fa9a';
  const pgFiles = await query('SELECT file_path FROM indexed_files WHERE repository_id = $1', [repoId]);
  const paths = pgFiles.rows.map(r => r.file_path);

  const pyFiles = paths.filter(p => p.endsWith('.py'));
  const mdFiles = paths.filter(p => p.endsWith('.md'));
  const jsFiles = paths.filter(p => p.endsWith('.js') || p.endsWith('.json') || p.endsWith('.yml') || p.endsWith('.yaml'));

  console.log('Total files:', paths.length);
  console.log('Python files:', pyFiles.length, pyFiles.slice(0, 10));
  console.log('Markdown files:', mdFiles.length);
  console.log('Config/other files:', jsFiles.length, jsFiles.slice(0, 10));
}

test().catch(console.error);
