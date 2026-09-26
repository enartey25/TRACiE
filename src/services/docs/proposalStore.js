const { query } = require('../../db/postgres');

/**
 * Persistence for documentation proposals (doc_proposals table).
 *
 * Shape mirrors the `doc_proposal` widget from Ethan's POST /api/docs/generate,
 * so his in-memory proposalStore Map can be swapped for:
 *   const proposals = require('../services/docs/proposalStore');
 *   await proposals.createProposal({ repositoryId, widget });
 */

const STATUSES = ['pending', 'approved', 'rejected'];

/** DB row -> widget-shaped JSON (snake_case, matching the doc_proposal widget). */
function toProposal(row) {
  return {
    ...(row.payload || {}),
    type: 'doc_proposal',
    proposal_id: row.id,
    repository_id: row.repository_id,
    status: row.status,
    target_file: row.target_file,
    diff_markdown: row.diff_markdown,
    rationale: row.rationale,
    pr_title: row.pr_title,
    pr_body: row.pr_body,
    affected_components: row.affected_components || [],
    review_note: row.review_note,
    created_at: row.generated_at,
    reviewed_at: row.reviewed_at
  };
}

/**
 * @param {object} p
 * @param {string} p.repositoryId
 * @param {object} p.widget - { diff_markdown (required), target_file?, rationale?, pr_title?, pr_body?, affected_components? }
 */
async function createProposal({ repositoryId, widget }) {
  const w = widget || {};
  const { rows } = await query(
    `INSERT INTO doc_proposals
       (repository_id, diff_markdown, target_file, rationale, pr_title, pr_body, affected_components, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
     RETURNING *`,
    [
      repositoryId,
      w.diff_markdown,
      w.target_file || null,
      w.rationale || null,
      w.pr_title || null,
      w.pr_body || null,
      JSON.stringify(Array.isArray(w.affected_components) ? w.affected_components : []),
      JSON.stringify(w)
    ]
  );
  return toProposal(rows[0]);
}

async function getProposal(id) {
  const { rows } = await query('SELECT * FROM doc_proposals WHERE id = $1', [id]);
  return rows[0] ? toProposal(rows[0]) : null;
}

async function listProposals(repositoryId, { status } = {}) {
  const params = [repositoryId];
  let where = 'repository_id = $1';
  if (status) {
    params.push(status);
    where += ' AND status = $2';
  }
  const { rows } = await query(`SELECT * FROM doc_proposals WHERE ${where} ORDER BY generated_at DESC`, params);
  return rows.map(toProposal);
}

/**
 * Approve/reject a pending proposal.
 * @returns {Promise<{ proposal: object|null, conflict?: string }>}
 */
async function reviewProposal(id, status, note) {
  const { rows } = await query(
    `UPDATE doc_proposals SET status = $2, reviewed_at = now(), review_note = $3
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, status, note || null]
  );
  if (rows[0]) return { proposal: toProposal(rows[0]) };
  const existing = await getProposal(id);
  if (!existing) return { proposal: null };
  return { proposal: existing, conflict: `Proposal is already ${existing.status}.` };
}

module.exports = { STATUSES, createProposal, getProposal, listProposals, reviewProposal };
