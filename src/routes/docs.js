const express = require('express');
const router = express.Router();
const { executeRAGQuery } = require('../services/rag/pipeline');
const dbProposals = require('../services/docs/proposalStore');
const { isUuid } = require('../services/sessions/sessionStore');
const { assertRepoAccess, assertProposalAccess } = require('../middleware/requireUser');

// In-memory proposal store (fallback & bridge to PostgreSQL doc_proposals table)
const proposalStore = new Map();

// Seed initial proposal for immediate UI review
proposalStore.set('prop-101', {
  proposal_id: 'prop-101',
  status: 'pending',
  target_file: 'README.md',
  diff_markdown: `--- a/README.md\n+++ b/README.md\n@@ -82,6 +82,10 @@\n ## API Endpoints\n \n+### Documentation & Inconsistency Detection\n+- \`POST /api/repos/:id/scan-docs\`: Scans code chunks against docs to detect architectural drift\n+- \`GET /api/repos/:id/doc-proposals\`: Lists pending and approved documentation proposals\n+- \`POST /api/doc-proposals/:id/approve\`: Approves proposal and triggers automated Git commit / PR\n`,
  rationale: 'Documentation inconsistency detection routes and Git automation endpoints added to backend require coverage in README overview.',
  pr_title: 'docs: document automated inconsistency detection and proposal routes',
  pr_body: 'Auto-generated documentation proposal produced by TRACiE DocWriterAgent.',
  affected_components: ['src/routes/repos.js', 'src/services/docs/docConsistencyChecker.js'],
  created_at: new Date().toISOString()
});

/**
 * POST /api/docs/generate
 * Analyzes code modifications or git diffs to generate a structured doc_proposal widget.
 */
router.post('/docs/generate', async (req, res) => {
  const { changedFiles = [], diffText = '', repoId = 'TRACiE' } = req.body || {};
  if (isUuid(repoId) && (await assertRepoAccess(req, res, repoId)) === null) return;

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

    // If repoId is a valid repository UUID, persist proposal to PostgreSQL doc_proposals table
    if (isUuid(repoId)) {
      try {
        const saved = await dbProposals.createProposal({ repositoryId: repoId, widget });
        return res.status(200).json(saved);
      } catch (err) {
        console.warn('[docs] Could not persist proposal to Postgres, using in-memory store:', err.message);
      }
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
router.get('/docs/proposals', async (req, res) => {
  const { repoId, repositoryId, status } = req.query;
  const targetRepo = repoId || repositoryId;

  if (isUuid(targetRepo)) {
    if ((await assertRepoAccess(req, res, targetRepo)) === null) return;
    try {
      const list = await dbProposals.listProposals(targetRepo, { status });
      return res.json({
        total: list.length,
        proposals: list
      });
    } catch (err) {
      console.warn('[docs] Could not fetch proposals from Postgres, falling back to in-memory store:', err.message);
    }
  }

  let proposals = Array.from(proposalStore.values());
  if (status) {
    proposals = proposals.filter(p => p.status === status);
  }
  res.json({
    total: proposals.length,
    proposals
  });
});

const { executeProposalCommit } = require('../services/docs/gitCommitEngine');

/**
 * POST /api/docs/proposals/:id/approve
 * Approves a documentation proposal and executes git commit & push.
 */
router.post('/docs/proposals/:id/approve', async (req, res) => {
  const proposalId = req.params.id;
  const note = req.body?.note;
  const token = req.user.accessToken || req.body?.token;

  if (isUuid(proposalId)) {
    if (!(await assertProposalAccess(req, res, proposalId))) return;
    try {
      const { proposal, conflict } = await dbProposals.reviewProposal(proposalId, 'approved', note);
      if (conflict) {
        return res.status(409).json({ error: conflict, proposal });
      }
      if (proposal) {
        const commitResult = await executeProposalCommit({ proposalId, token });
        const refreshed = await dbProposals.getProposal(proposalId);
        return res.json({
          status: 'success',
          message: commitResult.success ? `Proposal approved and ${commitResult.commitStatus}` : 'Proposal approved',
          proposal: refreshed || proposal,
          commitResult
        });
      }
    } catch (err) {
      console.warn('[docs] Postgres review failed, checking in-memory store:', err.message);
    }
  }

  const proposal = proposalStore.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  proposal.status = 'approved';
  proposal.reviewed_at = new Date().toISOString();
  if (note) proposal.review_note = note;
  res.json({ status: 'success', message: 'Proposal approved', proposal });
});

/**
 * POST /api/docs/proposals/:id/reject
 * Rejects a documentation proposal.
 */
router.post('/docs/proposals/:id/reject', async (req, res) => {
  const proposalId = req.params.id;
  const note = req.body?.note;

  if (isUuid(proposalId)) {
    if (!(await assertProposalAccess(req, res, proposalId))) return;
    try {
      const { proposal, conflict } = await dbProposals.reviewProposal(proposalId, 'rejected', note);
      if (conflict) {
        return res.status(409).json({ error: conflict, proposal });
      }
      if (proposal) {
        return res.json({ status: 'success', message: 'Proposal rejected', proposal });
      }
    } catch (err) {
      console.warn('[docs] Postgres review failed, checking in-memory store:', err.message);
    }
  }

  const proposal = proposalStore.get(proposalId);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  proposal.status = 'rejected';
  proposal.reviewed_at = new Date().toISOString();
  if (note) proposal.review_note = note;
  res.json({ status: 'success', message: 'Proposal rejected', proposal });
});

module.exports = router;
