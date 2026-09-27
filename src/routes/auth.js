const express = require('express');
const router = express.Router();
const axios = require('axios');
const userStore = require('../services/users/userStore');

/** Plain status page for OAuth failures, styled like the app (light theme, sage accents). */
function authPage(title, message) {
  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRACiE sign-in</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f2;color:#30404a;font-family:Inter,system-ui,sans-serif">
  <main style="max-width:420px;margin:16px;padding:28px;background:#fff;border:1px solid #e0e7e4;border-radius:14px">
    <h1 style="margin:0 0 8px;font-size:18px;font-weight:600">${esc(title)}</h1>
    <p style="margin:0 0 20px;color:#6b7d8a;font-size:14px;line-height:1.5">${esc(message)}</p>
    <a href="/" style="display:inline-block;padding:8px 16px;background:#2d6a4f;color:#fff;border-radius:7px;text-decoration:none;font-size:13px;font-weight:500">Back to TRACiE</a>
  </main>
</body></html>`;
}

const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID     || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
// Scopes: repo = read/write repos (needed for PR creation & direct push)
const GITHUB_SCOPE = 'repo,read:user,user:email';

/**
 * GET /auth/github
 * Redirects the browser to GitHub's OAuth authorization page.
 * Accepts an optional `return_to` query param to redirect back after login.
 */
router.get('/auth/github', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(503).json({
      error: 'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your environment.'
    });
  }

  // Persist where to redirect after login (defaults to '/')
  // Only same-site paths, so the login flow can't be used as an open redirect.
  const returnTo = String(req.query.return_to || '/');
  req.session.returnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPE,
    state: req.session.id   // CSRF protection
  });

  req.session.save((saveErr) => {
    if (saveErr) console.warn('[auth/github] session save warning:', saveErr.message);
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });
});

/**
 * GET /auth/github/callback
 * GitHub redirects here with ?code=... and ?state=...
 * Exchanges the code for an access token and stores it in the session.
 */
router.get('/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  // Validate CSRF state
  if (!state || state !== req.session.id) {
    return res.status(400).send(authPage('Sign-in expired', 'The sign-in link was already used or has expired. Go back and try again.'));
  }

  if (!code) {
    return res.status(400).send(authPage('Sign-in cancelled', 'GitHub did not return an authorization code.'));
  }

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code
      },
      { headers: { Accept: 'application/json' }, timeout: 10000 }
    );

    const { access_token, token_type, scope, error, error_description } = tokenRes.data;

    if (error || !access_token) {
      throw new Error(error_description || error || 'GitHub token exchange failed');
    }

    // Fetch authenticated user profile
    const userRes = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'TRACiE-Assistant'
      },
      timeout: 10000
    });

    const ghUser = userRes.data;
    const account = await userStore.upsertGithubUser(ghUser);
    req.session.userId = account.id;

    // Store in session
    req.session.github = {
      accessToken: access_token,
      tokenType: token_type || 'bearer',
      scope: scope || GITHUB_SCOPE,
      login: ghUser.login,
      name: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url || '',
      profileUrl: ghUser.html_url || '',
      authenticatedAt: new Date().toISOString()
    };

    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;

    // Persist session before redirecting back to the app with success indicator
    req.session.save((saveErr) => {
      if (saveErr) console.warn('[auth/github] session save warning:', saveErr.message);
      res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}gh_login=1`);
    });
  } catch (err) {
    console.error('[auth/github] OAuth callback failed:', err.message);
    res.status(500).send(authPage('GitHub sign-in failed', err.message));
  }
});

/**
 * GET /auth/me
 * Returns the currently authenticated GitHub user from session, or null.
 * Used by the frontend to show/hide the "Login with GitHub" button.
 */
router.get('/auth/me', (req, res) => {
  const gh = req.session && req.session.github;
  if (gh && gh.accessToken) {
    res.json({
      authenticated: true,
      userId: req.session.userId || null,
      login: gh.login,
      name: gh.name,
      avatarUrl: gh.avatarUrl,
      profileUrl: gh.profileUrl,
      scope: gh.scope,
      authenticatedAt: gh.authenticatedAt
    });
  } else {
    res.json({ authenticated: false });
  }
});

/**
 * POST /auth/logout
 * Destroys the current session (logs out from GitHub OAuth).
 */
router.post('/auth/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[auth/logout] Session destroy error:', err.message);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.clearCookie('tracie.sid');
    res.json({ status: 'ok', message: 'Logged out successfully.' });
  });
});

module.exports = router;
