const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');

// In-memory proposal store (bridges to Gabriel's PostgreSQL doc_proposals table)
const proposalStore = new Map();

// Seed initial proposal for immediate UI review
proposalStore.set('prop-101', {
  proposal_id: 'prop-101',
  status: 'pending',
  target_file: 'README.md',
  diff_markdown: `--- a/README.md\n+++ b/README.md\n@@ -20,3 +20,6 @@\n ## API Endpoints\n+- POST /api/docs/generate: Proposes documentation diffs\n+- GET /api/docs/proposals: Lists pending review proposals`,
  rationale: 'New documentation generation endpoints added in Phase 2 require documentation in project overview.',
  pr_title: 'docs: document Phase 2 documentation generation routes',
  pr_body: 'Auto-generated documentation proposal produced by TRACiE DocWriterAgent.',
  affected_components: ['src/routes/docs.js'],
  created_at: new Date().toISOString()
});

/**
 * POST /api/docs/generate
 * Analyzes code modifications or git diffs to generate a structured doc_proposal widget.
 */
router.post('/docs/generate', async (req, res) => {
  const { changedFiles = [], diffText = '', repoId = 'TRACiE' } = req.body || {};

  const query = diffText
    ? `Generate a documentation proposal and unified git diff for these changes:\n${diffText}`
    : `Generate a documentation proposal for modified files: ${changedFiles.join(', ')}`;

  try {
    const widget = await executeRAGQuery({
      query,
      repoId
    });

    // Ensure type is doc_proposal
    if (widget.type !== 'doc_proposal') {
      widget.type = 'doc_proposal';
      widget.target_file = widget.target_file || 'README.md';
      widget.diff_markdown = widget.diff_markdown || '--- a/README.md\n+++ b/README.md\n@@ -1,3 +1,5 @@\n+## Documentation Update';
      widget.pr_title = widget.pr_title || 'docs: automated update proposal';
    }

    const proposalId = widget.proposal_id || `prop-${Date.now()}`;
    widget.proposal_id = proposalId;

    // Store proposal in review store
    proposalStore.set(proposalId, {
      ...widget,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    res.status(200).json(widget);
  } catch (error) {
    console.error('Error generating doc proposal:', error);
    res.status(500).json({
      type: 'alert_card',
      severity: 'error',
      title: 'Documentation Generation Error',
      message: error.message
    });
  }
});

/**
 * GET /api/docs/proposals
 * Returns all pending documentation proposals (for Newlove's review panel).
 */
router.get('/docs/proposals', (req, res) => {
  const proposals = Array.from(proposalStore.values());
  res.json({
    total: proposals.length,
    proposals
  });
});

/**
 * POST /api/docs/proposals/:id/approve
 * Approves a documentation proposal.
 */
router.post('/docs/proposals/:id/approve', (req, res) => {
  const proposal = proposalStore.get(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  proposal.status = 'approved';
  proposal.reviewed_at = new Date().toISOString();
  res.json({ status: 'success', message: 'Proposal approved', proposal });
});

/**
 * POST /api/docs/proposals/:id/reject
 * Rejects a documentation proposal.
 */
router.post('/docs/proposals/:id/reject', (req, res) => {
  const proposal = proposalStore.get(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  proposal.status = 'rejected';
  proposal.reviewed_at = new Date().toISOString();
  res.json({ status: 'success', message: 'Proposal rejected', proposal });
});

module.exports = router;
