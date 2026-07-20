const { kvGet, kvSet } = require('./_kv');
const { sign, hashPin, verify } = require('./_session');
const { sendJson, getToken, logActivity, normalizeUser } = require('./_util');

// Bootstraps the `users` list from BUILT_IN_PINS on first run, so a fresh
// deployment has at least one admin without a manual seeding step.
// Format: "1234:Mehmet:admin,5678:Wei:sales+finance" — a user can hold more
// than one role, separated by "+" within their entry.
function parseBuiltInPins() {
  const raw = process.env.BUILT_IN_PINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [pin, name, roleSpec] = entry.split(':');
      const roles = (roleSpec || 'admin').split('+').map((r) => r.trim()).filter(Boolean);
      return { pin, name: name || 'Admin', roles: roles.length ? roles : ['admin'] };
    });
}

async function ensureUsers() {
  let users = await kvGet('users');
  if (!users || users.length === 0) {
    const builtins = parseBuiltInPins();
    users = builtins.map((b, i) => ({
      id: `user_bootstrap_${i}`,
      name: b.name,
      roles: b.roles,
      pinHash: hashPin(b.pin),
      pages: [],
      active: true,
      createdAt: Date.now(),
    }));
    if (users.length) await kvSet('users', users);
  }
  return users || [];
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { pin } = req.body || {};
    if (!pin) return sendJson(res, 400, { error: 'PIN required' });
    const users = await ensureUsers();
    const pinHash = hashPin(pin);
    const found = users.find((u) => u.pinHash === pinHash && u.active !== false);
    if (!found) return sendJson(res, 401, { error: 'Invalid PIN' });
    const user = normalizeUser(found);
    const token = sign({ id: user.id, name: user.name, roles: user.roles || [], pages: user.pages || [] });
    await logActivity({ id: user.id, name: user.name }, 'login', 'session', user.id);
    return sendJson(res, 200, {
      token,
      user: { id: user.id, name: user.name, roles: user.roles || [], pages: user.pages || [] },
    });
  }

  if (req.method === 'GET') {
    const session = verify(getToken(req));
    if (!session) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { user: session });
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
