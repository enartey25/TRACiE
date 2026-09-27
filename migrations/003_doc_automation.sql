-- 003_doc_automation.sql: Add contributor role and commit automation settings

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS user_role   TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS auto_commit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commit_mode TEXT NOT NULL DEFAULT 'pr',
  ADD COLUMN IF NOT EXISTS push_branch TEXT NOT NULL DEFAULT 'tracie-docs-update';

ALTER TABLE doc_proposals
  ADD COLUMN IF NOT EXISTS commit_status TEXT NOT NULL DEFAULT 'uncommitted',
  ADD COLUMN IF NOT EXISTS commit_sha    TEXT,
  ADD COLUMN IF NOT EXISTS pr_url        TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT;
