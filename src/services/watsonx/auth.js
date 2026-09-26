const axios = require('axios');
const config = require('../../config/watsonx');

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Checks if the current configuration has real credentials provided.
 */
function hasValidCredentials() {
  return Boolean(
    config.apiKey &&
    config.apiKey !== 'your_ibm_cloud_api_key_here' &&
    config.projectId &&
    config.projectId !== 'your_watsonx_project_id_here'
  );
}

/**
 * Obtains an IAM access token from IBM Cloud using the API key.
 * Caches the token in-memory and refreshes 5 minutes before expiration.
 */
async function getIamToken() {
  if (!hasValidCredentials()) {
    throw new Error(
      'Missing or placeholder IBM watsonx.ai credentials. Please set WATSONX_APIKEY and WATSONX_PROJECT_ID in your .env file.'
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiresAt > now + 300) {
    return cachedToken;
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'urn:ibm:params:oauth:grant-type:apikey');
    params.append('apikey', config.apiKey);

    const response = await axios.post('https://iam.cloud.ibm.com/identity/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    cachedToken = response.data.access_token;
    tokenExpiresAt = response.data.expiration || (now + (response.data.expires_in || 3600));
    return cachedToken;
  } catch (error) {
    const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
    throw new Error(`Failed to obtain IBM Cloud IAM token: ${errorDetails}`);
  }
}

/**
 * Returns the authorization headers required for watsonx.ai REST endpoints.
 */
async function getAuthHeaders() {
  const token = await getIamToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

/**
 * Verifies IBM Cloud IAM authentication.
 */
async function verifyAuth() {
  if (!hasValidCredentials()) {
    return {
      authenticated: false,
      reason: 'No live credentials configured in .env (running in sandbox/mock mode).'
    };
  }
  try {
    const token = await getIamToken();
    return {
      authenticated: true,
      tokenPreview: `${token.substring(0, 8)}...${token.substring(token.length - 6)}`,
      expiresAt: new Date(tokenExpiresAt * 1000).toISOString()
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error.message
    };
  }
}

module.exports = {
  hasValidCredentials,
  getIamToken,
  getAuthHeaders,
  verifyAuth
};
