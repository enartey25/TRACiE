const crypto = require('crypto');
const config = require('../config/backend');

/**
 * AES-256-GCM encryption for repository access tokens at rest.
 * TOKEN_ENCRYPTION_KEY: 32 bytes as 64 hex chars
 *   generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * Stored format: iv:authTag:ciphertext (all hex).
 */
function getKey() {
  const key = config.tokenEncryptionKey;
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex chars to store repository tokens. See .env.example.');
  }
  return Buffer.from(key, 'hex');
}

function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join(':');
}

function decrypt(stored) {
  if (!stored) return null;
  const [ivHex, tagHex, dataHex] = stored.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
