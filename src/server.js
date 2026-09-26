const express = require('express');
const cors = require('cors');
const config = require('./config/watsonx');
const { verifyAuth } = require('./services/watsonx/auth');
const queryRouter = require('./routes/query');
const streamRouter = require('./routes/stream');
const fixtures = require('./contracts/fixtures');
const reposRouter = require('./routes/repos');
const webhooksRouter = require('./routes/webhooks');
const sessionsRouter = require('./routes/sessions');
const docProposalsRouter = require('./routes/docProposals');
const postgres = require('./db/postgres');
const chroma = require('./db/chroma');
const repoStore = require('./services/repos/repoStore');

const path = require('path');

const app = express();

// Middlewares
app.use(cors());
// GitHub webhooks need the raw body for HMAC verification, so mount before express.json().
app.use('/api/webhooks', webhooksRouter);
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

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

// Authentication Status Route
app.get('/api/auth/status', async (req, res) => {
  const status = await verifyAuth();
  res.json(status);
});

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

// Ethan's Core Routes
app.use('/api', queryRouter);
app.use('/api', streamRouter);

// Gabriel's Repository Ingestion Routes
app.use('/api', reposRouter);
app.use('/api', sessionsRouter);
app.use('/api', docProposalsRouter);

// Start server if run directly
if (require.main === module) {
  const PORT = config.port;
  repoStore.failOrphanedJobs()
    .then(n => n && console.log(`[startup] marked ${n} orphaned indexing job(s) as failed`))
    .catch(e => console.warn(`[startup] Postgres not ready: ${e.message}`));

  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 TRACiE Backend Service running on port ${PORT}`);
    console.log(`   - Health:   http://localhost:${PORT}/api/health`);
    console.log(`   - Auth:     http://localhost:${PORT}/api/auth/status`);
    console.log(`   - Query:    POST http://localhost:${PORT}/api/query`);
    console.log(`   - Stream:   GET  http://localhost:${PORT}/api/stream`);
    console.log(`   - Fixtures: http://localhost:${PORT}/api/fixtures`);
    console.log(`   - Repos:    POST/GET http://localhost:${PORT}/api/repos`);
    console.log(`   - Status:   GET  http://localhost:${PORT}/api/repos/:id/status`);
    console.log(`   - Webhook:  POST http://localhost:${PORT}/api/webhooks/github`);
    console.log(`   - API docs: see API.md`);
    console.log(`===============================================`);
  });
}

module.exports = app;
