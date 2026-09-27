const { query } = require('../../db/postgres');

/**
 * GitHub-backed user accounts and the repositories linked to each account.
 * Repositories (and their Chroma index) are shared by URL; user_repositories decides
 * who can see and query them.
 */

const USER_COLUMNS = 'id, github_id, login, name, avatar_url, profile_url, preferences, created_at, last_login_at';

/** Create or refresh the account for a GitHub profile (from GET https://api.github.com/user). */
async function upsertGithubUser(ghUser) {
  const { rows } = await query(
    `INSERT INTO users (github_id, login, name, avatar_url, profile_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (github_id) DO UPDATE
       SET login = EXCLUDED.login, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url,
           profile_url = EXCLUDED.profile_url, last_login_at = now()
     RETURNING ${USER_COLUMNS}`,
    [ghUser.id, ghUser.login, ghUser.name || ghUser.login, ghUser.avatar_url || '', ghUser.html_url || '']
  );
  return rows[0];
}

async function getUser(id) {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** Shallow-merge into the user's preferences JSON. */
async function updatePreferences(id, patch) {
  const { rows } = await query(
    `UPDATE users SET preferences = preferences || $2::jsonb WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, JSON.stringify(patch || {})]
  );
  return rows[0] || null;
}

async function linkRepository(userId, repositoryId, userRole = 'unknown') {
  await query(
    `INSERT INTO user_repositories (user_id, repository_id, user_role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, repository_id) DO UPDATE
       SET user_role = CASE WHEN EXCLUDED.user_role <> 'unknown' THEN EXCLUDED.user_role
                            ELSE user_repositories.user_role END`,
    [userId, repositoryId, userRole]
  );
}

async function unlinkRepository(userId, repositoryId) {
  const { rowCount } = await query(
    'DELETE FROM user_repositories WHERE user_id = $1 AND repository_id = $2',
    [userId, repositoryId]
  );
  return rowCount > 0;
}

/** @returns {Promise<string|null>} the user's role on the repository, or null when not linked. */
async function getRepositoryRole(userId, repositoryId) {
  const { rows } = await query(
    'SELECT user_role FROM user_repositories WHERE user_id = $1 AND repository_id = $2',
    [userId, repositoryId]
  );
  return rows[0] ? rows[0].user_role : null;
}

async function setRepositoryRole(userId, repositoryId, userRole) {
  await query(
    'UPDATE user_repositories SET user_role = $3 WHERE user_id = $1 AND repository_id = $2',
    [userId, repositoryId, userRole]
  );
}

module.exports = {
  upsertGithubUser, getUser, updatePreferences,
  linkRepository, unlinkRepository, getRepositoryRole, setRepositoryRole
};
