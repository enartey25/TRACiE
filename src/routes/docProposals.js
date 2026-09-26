const express = require('express');
const router = express.Router();
const proposals = require('../services/docs/proposalStore');
const repoStore = require('../services/repos/repoStore');
const { isUuid } = require('../services/sessions/sessionStore');

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
    if (!(await repoStore.getRepository(req.params.id))) {
      return res.status(404).json({ error: 'Repository not found.' });
    }
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
    const proposal = await proposals.getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/doc-proposals/:id/approve | /reject   body (optional): { note } -> proposal; 409 if not pending */
for (const [action, status] of [['approve', 'approved'], ['reject', 'rejected']]) {
  router.post(`/doc-proposals/:id/${action}`, async (req, res) => {
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid proposal id.' });
    try {
      const { proposal, conflict } = await proposals.reviewProposal(req.params.id, status, req.body && req.body.note);
      if (!proposal) return res.status(404).json({ error: 'Proposal not found.' });
      if (conflict) return res.status(409).json({ error: conflict, proposal });
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = router;
