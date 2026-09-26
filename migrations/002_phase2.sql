-- Phase 2: incremental re-indexing, git history ingestion, doc proposal fields.

-- One row per indexed source file; blob_sha lets re-index skip unchanged files.
CREATE TABLE indexed_files (
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path     TEXT NOT NULL,
  blob_sha      TEXT NOT NULL,                             -- git blob SHA at HEAD
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, file_path)
);

ALTER TABLE repositories
  ADD COLUMN history_indexed_at TIMESTAMPTZ,              -- last successful commit/PR ingestion
  ADD COLUMN pending_reindex    BOOLEAN NOT NULL DEFAULT false; -- webhook arrived mid-job; run again after

ALTER TABLE indexing_jobs
  ADD COLUMN trigger         TEXT NOT NULL DEFAULT 'connect'
                             CHECK (trigger IN ('connect', 'reindex', 'webhook')),
  ADD COLUMN full_reindex    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN files_unchanged INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN files_removed   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN history_status  TEXT,                         -- skipped | running | complete | failed
  ADD COLUMN history_chunks  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN history_error   TEXT;

-- Match the doc_proposal widget shape Ethan's /api/docs/generate produces.
ALTER TABLE doc_proposals
  ADD COLUMN target_file         TEXT,
  ADD COLUMN rationale           TEXT,
  ADD COLUMN pr_title            TEXT,
  ADD COLUMN pr_body             TEXT,
  ADD COLUMN affected_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN payload             JSONB,                    -- full original widget, for anything not modelled above
  ADD COLUMN review_note         TEXT;

CREATE INDEX idx_doc_proposals_status ON doc_proposals(repository_id, status);
CREATE INDEX idx_sessions_last_active ON sessions(repository_id, last_active DESC);
