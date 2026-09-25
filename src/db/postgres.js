const { Pool } = require('pg');
const config = require('../config/backend');

let pool = null;

function getPool() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      max: 10
    });
    pool.on('error', (err) => console.error('[postgres] idle client error:', err.message));
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

/** Returns { ok, latencyMs, error? } — used by /api/health. */
async function ping() {
  const started = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = { getPool, query, ping, close };
