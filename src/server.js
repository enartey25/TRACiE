// Tree-sitter's large WASM grammars (e.g. Swift) crash V8's TurboFan tier-up with a fatal
// "out of memory: Zone" during ingestion. --liftoff-only prevents it, but it's a startup-only
// flag, so if we were launched without it (plain `node src/server.js`, IDE, nodemon), relaunch.
if (require.main === module && !process.execArgv.includes('--liftoff-only')) {
  const { spawn } = require('child_process');
  const child = spawn(process.execPath, ['--liftoff-only', ...process.execArgv, __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
  ['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => child.kill(sig)));
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
  return;
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const config = require('./config/watsonx');
const backendConfig = require('./config/backend');
const { verifyAuth } = require('./services/watsonx/auth');
const { getEmbeddingMode } = require('./services/watsonx/embedding');
const queryRouter = require('./routes/query');
const streamRouter = require('./routes/stream');
const sessionRouter = require('./routes/session');
const docsRouter = require('./routes/docs');
const audioRouter = require('./routes/audio');
const fixtures = require('./contracts/fixtures');
const reposRouter = require('./routes/repos');
const webhooksRouter = require('./routes/webhooks');
const sessionsRouter = require('./routes/sessions');
const docProposalsRouter = require('./routes/docProposals');
const authRouter = require('./routes/auth');
const meRouter = require('./routes/me');
const { requireUser } = require('./middleware/requireUser');
const postgres = require('./db/postgres');
const chroma = require('./db/chroma');
const repoStore = require('./services/repos/repoStore');
const { getGlobalCacheStats, clearAllCaches } = require('./services/rag/ragCache');

const path = require('path');

const app = express();

// Trust reverse proxy (Render, Cloudflare, etc.) so secure cookies work over HTTPS
app.set('trust proxy', 1);

// Static assets are served before the session middleware: they don't need a session, and
// loading one costs a Postgres round trip per file (~1s per asset against remote Supabase).
// no-cache (not no-store) still revalidates every load, but unchanged files come back as 304s.
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// ── Session Middleware ────────────────────────────────────────────────────────
// Sessions are stored in the existing Postgres database.
// connect-pg-simple creates the "session" table automatically on first use.
app.use(session({
  store: new PgSession({
    // Reuse the app's pool rather than opening a second one for sessions.
    pool: postgres.getPool(),
    tableName: 'tracie_sessions',
    createTableIfMissing: true
  }),
  name: 'tracie.sid',
  secret: process.env.SESSION_SECRET || backendConfig.tokenEncryptionKey || 'tracie-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',   // HTTPS-only in prod
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000                 // 7 days
  }
}));

// Middlewares
app.use(cors({ credentials: true, origin: process.env.APP_ORIGIN || true }));
// GitHub webhooks need the raw body for HMAC verification, so mount before express.json().
app.use('/api/webhooks', webhooksRouter);
app.use(express.json());

// Health & System Diagnostic Route
// Returns 200 with status 'ok' when Postgres + ChromaDB are reachable, 'degraded' otherwise.
app.get('/api/health', async (req, res) => {
  const [pg, vector] = await Promise.all([postgres.ping(), chroma.ping()]);
  res.json({
    status: pg.ok && vector.ok ? 'ok' : 'degraded',
    service: 'TRACiE AI Assistant Backend',
    timestamp: new Date().toISOString(),
    dependencies: { postgres: pg, chromadb: vector }
  });
});

// Everything under /api below needs a signed-in GitHub user, except the public paths
// listed in middleware/requireUser.js (health, auth status, fixtures, webhooks).
app.use('/api', requireUser);

// Cache Telemetry & Invalidation Routes
app.get('/api/cache/stats', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats: getGlobalCacheStats()
  });
});

app.post('/api/cache/clear', (req, res) => {
  clearAllCaches();
  res.json({ status: 'ok', message: 'All RAG caches cleared successfully.' });
});

// WatsonX Authentication Status Route
app.get('/api/auth/status', async (req, res) => {
  const status = await verifyAuth();
  res.json(status);
});

// GitHub OAuth Routes (/auth/github, /auth/github/callback, /auth/me, /auth/logout)
app.use('/', authRouter);

// Fixtures Route (for Romel & Newlove to preview widgets directly)
app.get('/api/fixtures', (req, res) => {
  res.json(fixtures);
});

app.get('/api/fixtures/:type', (req, res) => {
  const fixture = fixtures[req.params.type];
  if (fixture) {
    res.json(fixture);
  } else {
    res.status(404).json({ error: `Fixture '${req.params.type}' not found.` });
  }
});

// Signed-in user's account and preferences
app.use('/api', meRouter);

// Ethan's Core Routes (Phase 1 & Phase 2)
app.use('/api', queryRouter);
app.use('/api', streamRouter);
app.use('/api', sessionRouter);
app.use('/api', docsRouter);
app.use('/api', audioRouter);

// Gabriel's Repository Ingestion Routes
app.use('/api', reposRouter);
app.use('/api', sessionsRouter);
app.use('/api', docProposalsRouter);

// JSON errors for anything a route passed to next(err)
app.use((err, req, res, next) => {
  console.error('[server] unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Start server if run directly
if (require.main === module) {
  const PORT = config.port;

  // Fail orphaned jobs BEFORE accepting requests so getActiveJob() never sees stale pending/running jobs.
  repoStore.failOrphanedJobs()
    .then(n => n && console.log(`[startup] marked ${n} orphaned indexing job(s) as failed`))
    .catch(e => console.warn(`[startup] Postgres not ready: ${e.message}`))
    .then(() => chroma.ping())
    .then(vector => {
      if (!vector || !vector.ok) {
        console.warn(`[startup] ⚠️  ChromaDB unreachable at ${backendConfig.chromaApiKey ? 'Chroma Cloud' : backendConfig.chromaUrl}: ${vector && vector.error}`);
        console.warn(`      Cloning/embedding will still run, but indexing and RAG queries will fail until it's reachable.`);
        console.warn(`      Local dev: start it with \`npm run chroma\` in another terminal.`);
      }
    })
    .catch(() => {})
    .finally(() => app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 TRACiE Backend Service running on port ${PORT}`);
    console.log(`   - Health:   http://localhost:${PORT}/api/health`);
    console.log(`   - Auth:     http://localhost:${PORT}/api/auth/status`);
    console.log(`   - GitHub:   GET  http://localhost:${PORT}/auth/github  (OAuth login)`);
    console.log(`   - Me:       GET  http://localhost:${PORT}/auth/me      (session user)`);
    console.log(`   - Query:    POST http://localhost:${PORT}/api/query`);
    console.log(`   - Stream:   GET  http://localhost:${PORT}/api/stream`);
    console.log(`   - Fixtures: http://localhost:${PORT}/api/fixtures`);
    console.log(`   - Repos:    POST/GET http://localhost:${PORT}/api/repos`);
    console.log(`   - Status:   GET  http://localhost:${PORT}/api/repos/:id/status`);
    console.log(`   - Webhook:  POST http://localhost:${PORT}/api/webhooks/github`);
    console.log(`   - API docs: see API.md`);
    if (!process.env.GITHUB_CLIENT_ID) {
      console.log(`   ⚠️  GITHUB_CLIENT_ID not set — OAuth login will return 503.`);
      console.log(`      Set GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET to enable GitHub OAuth.`);
    }
    const embeddingMode = getEmbeddingMode();
    if (embeddingMode === 'huggingface') {
      console.log(`   ℹ️  WATSONX_APIKEY/WATSONX_PROJECT_ID not set — embedding via HuggingFace Inference API (HF_TOKEN).`);
    } else if (!embeddingMode) {
      console.log(`   ⚠️  No WATSONX or HF_TOKEN credentials set — ingestion and RAG queries will fail until one is configured.`);
    }
    console.log(`===============================================`);
  }));
}

module.exports = app;
