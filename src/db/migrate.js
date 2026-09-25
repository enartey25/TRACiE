/**
 * Minimal SQL migration runner.
 * Applies migrations/*.sql in filename order, each in its own transaction,
 * and records applied files in schema_migrations.
 *
 * Usage: npm run db:migrate
 */
const fs = require('fs');
const path = require('path');
const { getPool, close } = require('./postgres');

const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function migrate() {
  const client = await getPool().connect();
  try {
    // Advisory lock so two teammates running migrate against a shared DB don't race.
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map(r => r.filename));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] applying ${file}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        count++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }
    console.log(count ? `[migrate] applied ${count} migration(s)` : '[migrate] up to date');
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => close())
    .catch(async (error) => {
      console.error(error.message);
      await close();
      process.exit(1);
    });
}

module.exports = { migrate };
