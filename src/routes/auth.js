const express = require('express');
const router = express.Router();
const axios = require('axios');

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
  req.session.returnTo = req.query.return_to || '/';

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: GITHUB_SCOPE,
    state: req.session.id   // CSRF protection
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
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
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
        <h2>⚠️ Invalid OAuth state</h2>
        <p>CSRF check failed. Please <a href="/" style="color:#38bdf8">go back and try again</a>.</p>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
        <h2>⚠️ No authorization code</h2>
        <p>GitHub did not return an authorization code. <a href="/" style="color:#38bdf8">Return home</a>.</p>
      </body></html>
    `);
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

    // Redirect back to the app with success indicator
    res.redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}gh_login=1`);
  } catch (err) {
    console.error('[auth/github] OAuth callback failed:', err.message);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
        <h2>❌ GitHub Login Failed</h2>
        <p>${err.message}</p>
        <a href="/" style="color:#38bdf8">Return to TRACiE</a>
      </body></html>
    `);
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
