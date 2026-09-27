-- 004_user_accounts.sql: GitHub-backed user accounts.
-- Repositories stay shared (one index per URL), but each user only sees the repositories
-- linked to their account, and only the chat sessions they created.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id     BIGINT NOT NULL UNIQUE,
  login         TEXT NOT NULL,
  name          TEXT,
  avatar_url    TEXT,
  profile_url   TEXT,
  preferences   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_repositories (
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  user_role     TEXT NOT NULL DEFAULT 'unknown',
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, repository_id)
);

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_repositories_repo ON user_repositories(repository_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_last_active ON sessions(user_id, last_active DESC);
