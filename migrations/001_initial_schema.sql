-- Initial schema for TRACiE backend.
-- gen_random_uuid() is built into Postgres 13+ (and Supabase).

CREATE TABLE repositories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT NOT NULL UNIQUE,
  name            TEXT,                                   -- "owner/repo", for display
  platform        TEXT NOT NULL DEFAULT 'github',
  encrypted_token TEXT,                                   -- AES-256-GCM, see src/utils/crypto.js
  index_status    TEXT NOT NULL DEFAULT 'pending'
                  CHECK (index_status IN ('pending', 'indexing', 'ready', 'failed')),
  last_commit_sha TEXT,                                   -- Phase 2: webhook re-index diffing
  last_indexed    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_agent    TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE queries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  raw_text            TEXT NOT NULL,
  retrieved_chunk_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  llm_response        JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE indexing_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  stage         TEXT,                                     -- cloning | parsing | embedding | done
  files_total   INTEGER NOT NULL DEFAULT 0,
  chunks_total  INTEGER NOT NULL DEFAULT 0,
  chunks_done   INTEGER NOT NULL DEFAULT 0,
  chunks_failed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE TABLE doc_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  diff_markdown TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX idx_sessions_repository      ON sessions(repository_id);
CREATE INDEX idx_queries_session          ON queries(session_id);
CREATE INDEX idx_indexing_jobs_repository ON indexing_jobs(repository_id, started_at DESC);
CREATE INDEX idx_doc_proposals_repository ON doc_proposals(repository_id);
