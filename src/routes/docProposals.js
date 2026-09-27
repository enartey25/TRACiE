const express = require('express');
const router = express.Router();
const proposals = require('../services/docs/proposalStore');
const repoStore = require('../services/repos/repoStore');
const { isUuid } = require('../services/sessions/sessionStore');
const { assertRepoAccess, assertProposalAccess } = require('../middleware/requireUser');

/**
 * Documentation proposals stored in Postgres.
 * (Ethan's /api/docs/* routes are separate and currently in-memory.)
 */

/**
 * POST /api/repos/:id/doc-proposals
 * Body: doc_proposal widget — { diff_markdown (required), target_file?, rationale?, pr_title?, pr_body?,
 *       affected_components?: string[] }  (camelCase diffMarkdown is accepted too)
 * -> 201 proposal
 */
router.post('/repos/:id/doc-proposals', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid repository id.' });
  const body = req.body || {};
  const widget = { ...body, diff_markdown: body.diff_markdown || body.diffMarkdown };
  delete widget.diffMarkdown;
  if (!widget.diff_markdown || typeof widget.diff_markdown !== 'string') {
    return res.status(400).json({ error: 'Field "diff_markdown" is required.' });
  }
  try {
    if ((await assertRepoAccess(req, res, req.params.id)) === null) return;
    res.status(201).json(await proposals.createProposal({ repositoryId: req.params.id, widget }));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/repos/:id/doc-proposals[?status=pending|approved|rejected] -> { total, proposals } */
router.get('/repos/:id/doc-proposals', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid repository id.' });
  const { status } = req.query;
  if (status && !proposals.STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of ${proposals.STATUSES.join(', ')}` });
  }
  try {
    if ((await assertRepoAccess(req, res, req.params.id)) === null) return;
    const list = await proposals.listProposals(req.params.id, { status });
    res.json({ total: list.length, proposals: list });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/doc-proposals/:id -> proposal */
router.get('/doc-proposals/:id', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid proposal id.' });
  try {
    const proposal = await assertProposalAccess(req, res, req.params.id);
    if (proposal) res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const { executeProposalCommit } = require('../services/docs/gitCommitEngine');

/** POST /api/doc-proposals/:id/approve  body (optional): { note, token } -> approved proposal with commit details */
router.post('/doc-proposals/:id/approve', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid proposal id.' });
  try {
    if (!(await assertProposalAccess(req, res, req.params.id))) return;
    const { proposal, conflict } = await proposals.reviewProposal(req.params.id, 'approved', req.body && req.body.note);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
    if (conflict) return res.status(409).json({ error: conflict, proposal });

    // Commit as the signed-in user; fall back to an explicit body.token.
    const sessionToken = req.user.accessToken;

    // Execute git commit and push / PR creation
    const commitResult = await executeProposalCommit({
      proposalId: req.params.id,
      token: sessionToken || req.body?.token
    });

    const refreshed = await proposals.getProposal(req.params.id);
    res.json({
      status: 'success',
      message: commitResult.success ? `Proposal approved and ${commitResult.commitStatus}` : 'Proposal approved (commit skipped or failed)',
      proposal: refreshed || proposal,
      commitResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/doc-proposals/:id/reject  body (optional): { note } */
router.post('/doc-proposals/:id/reject', async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid proposal id.' });
  try {
    if (!(await assertProposalAccess(req, res, req.params.id))) return;
    const { proposal, conflict } = await proposals.reviewProposal(req.params.id, 'rejected', req.body && req.body.note);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
    if (conflict) return res.status(409).json({ error: conflict, proposal });
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
