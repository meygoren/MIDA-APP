// Admin-only user management: role + per-user `pages` grant array (so a
// non-admin can be given access to specific pages without a new role).
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId } = require('./_util');
const { hashPin } = require('./_session');

function strip(u) {
  const { pinHash, ...rest } = u;
  return rest;
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, {});
  if (!session) return;

  const users = (await kvGet('users')) || [];

  // Any authenticated user can read the (PIN-free) user list, e.g. to
  // populate a task "assigned to" picker. Writes stay admin-only.
  if (req.method === 'GET') {
    return sendJson(res, 200, users.map(strip));
  }

  if (session.role !== 'admin') return sendJson(res, 403, { error: 'Admin only' });

  if (req.method === 'POST') {
    const { name, role, pin, pages } = req.body || {};
    if (!name || !role || !pin) return sendJson(res, 400, { error: 'name, role, pin required' });
    if (users.some((u) => hashPin(pin) === u.pinHash)) {
      return sendJson(res, 400, { error: 'PIN already in use' });
    }
    const user = {
      id: genId('user'),
      name,
      role,
      pinHash: hashPin(pin),
      pages: pages || [],
      active: true,
      createdAt: Date.now(),
    };
    users.push(user);
    await kvSet('users', users);
    await logActivity(session, 'create', 'user', user.id);
    return sendJson(res, 201, strip(user));
  }

  if (req.method === 'PUT') {
    const { id, pin, ...updates } = req.body || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    users[idx] = { ...users[idx], ...updates };
    if (pin) users[idx].pinHash = hashPin(pin);
    await kvSet('users', users);
    await logActivity(session, 'update', 'user', id);
    return sendJson(res, 200, strip(users[idx]));
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    if (id === session.id) return sendJson(res, 400, { error: "Can't delete your own account" });
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = users.splice(idx, 1);
    await kvSet('users', users);
    await logActivity(session, 'delete', 'user', id);
    return sendJson(res, 200, strip(removed));
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
