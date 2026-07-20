// PIN-based auth: no passwords, no OAuth. A logged-in staff member gets a
// signed, stateless session token (HMAC-SHA256), and PINs are stored as
// HMAC hashes rather than plaintext.

const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function sign(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPin(pin) {
  return crypto.createHmac('sha256', SECRET).update(String(pin)).digest('hex');
}

module.exports = { sign, verify, hashPin };
