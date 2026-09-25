const express = require('express');
const router = express.Router();

/**
 * Phase 2 extension points — routes are registered so the contract is visible,
 * but they return 501 until implemented.
 *
 *  - POST /api/webhooks/github         push-triggered re-index -> call startIngestion() from
 *                                       services/ingestion/pipeline.js (verify X-Hub-Signature-256 first)
 *  - POST /api/sessions                 create a sessions row for a repository
 *  - GET  /api/repos/:id/doc-proposals  list doc_proposals
 *  - POST /api/doc-proposals/:id/review approve / reject a proposal
 */
const notImplemented = (feature) => (req, res) =>
  res.status(501).json({ error: `${feature} is planned for Phase 2 and not implemented yet.` });

router.post('/webhooks/github', notImplemented('GitHub webhook re-indexing'));
router.post('/sessions', notImplemented('Session persistence'));
router.get('/repos/:id/doc-proposals', notImplemented('Documentation proposals'));
router.post('/doc-proposals/:id/review', notImplemented('Documentation proposal review'));

module.exports = router;
