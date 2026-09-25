const express = require('express');
const cors = require('cors');
const config = require('./config/watsonx');
const { verifyAuth } = require('./services/watsonx/auth');
const queryRouter = require('./routes/query');
const streamRouter = require('./routes/stream');
const fixtures = require('./contracts/fixtures');

const path = require('path');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health & System Diagnostic Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TRACiE AI Assistant Backend',
    timestamp: new Date().toISOString()
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

// Start server if run directly
if (require.main === module) {
  const PORT = config.port;
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 TRACiE Backend Service running on port ${PORT}`);
    console.log(`   - Health:   http://localhost:${PORT}/api/health`);
    console.log(`   - Auth:     http://localhost:${PORT}/api/auth/status`);
    console.log(`   - Query:    POST http://localhost:${PORT}/api/query`);
    console.log(`   - Stream:   GET  http://localhost:${PORT}/api/stream`);
    console.log(`   - Fixtures: http://localhost:${PORT}/api/fixtures`);
    console.log(`===============================================`);
  });
}

module.exports = app;
