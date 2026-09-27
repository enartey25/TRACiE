const express = require('express');
const router = express.Router();
const userStore = require('../services/users/userStore');

/** Signed-in user's account + preferences, used by the Settings panel. */

const ALLOWED_PREFERENCES = {
  showAgentActivity: v => typeof v === 'boolean',
  autoOpenCanvas: v => typeof v === 'boolean',
  defaultRepositoryId: v => v === null || typeof v === 'string'
};

const userView = u => ({
  id: u.id,
  login: u.login,
  name: u.name,
  avatarUrl: u.avatar_url,
  profileUrl: u.profile_url,
  preferences: u.preferences || {},
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at
});

/** GET /api/me -> User */
router.get('/me', async (req, res) => {
  try {
    const user = await userStore.getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'Account not found.' });
    res.json(userView(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/** PATCH /api/me/preferences { showAgentActivity?, autoOpenCanvas?, defaultRepositoryId? } -> User */
router.patch('/me/preferences', async (req, res) => {
  const body = req.body || {};
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    const valid = ALLOWED_PREFERENCES[key];
    if (!valid) return res.status(400).json({ error: `Unknown preference "${key}".` });
    if (!valid(value)) return res.status(400).json({ error: `Invalid value for "${key}".` });
    patch[key] = value;
  }
  try {
    res.json(userView(await userStore.updatePreferences(req.user.id, patch)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
