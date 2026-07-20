// Self-service PIN change: any authenticated user can change their own
// PIN after verifying their current one. Distinct from api/users.js,
// which is the admin-only path for resetting someone else's PIN.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity } = require('./_util');
const { hashPin } = require('./_session');

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, {});
  if (!session) return;
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  const { currentPin, newPin } = req.body || {};
  if (!currentPin || !newPin) return sendJson(res, 400, { error: 'Current and new PIN are required' });
  if (String(newPin).length < 4) return sendJson(res, 400, { error: 'New PIN must be at least 4 characters' });

  const users = (await kvGet('users')) || [];
  const idx = users.findIndex((u) => u.id === session.id);
  if (idx === -1) return sendJson(res, 404, { error: 'Account not found' });

  if (hashPin(currentPin) !== users[idx].pinHash) {
    return sendJson(res, 400, { error: 'Current PIN is incorrect' });
  }

  const newHash = hashPin(newPin);
  if (users.some((u) => u.id !== session.id && u.pinHash === newHash)) {
    return sendJson(res, 400, { error: 'That PIN is already in use' });
  }

  users[idx] = { ...users[idx], pinHash: newHash, updatedAt: Date.now() };
  await kvSet('users', users);
  await logActivity(session, 'update', 'user', session.id, 'changed own PIN');
  return sendJson(res, 200, { ok: true });
};
