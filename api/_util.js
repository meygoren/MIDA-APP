const { verify } = require('./_session');
const { kvGet, kvSet } = require('./_kv');

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// A user can hold more than one role at once, so `session.roles` is always
// an array — these helpers are the one place that knows that.
function hasRole(session, role) {
  return (session.roles || []).includes(role);
}
function hasAnyRole(session, roles) {
  return (session.roles || []).some((r) => roles.includes(r));
}

// User records created before multi-role support only have a singular
// `role` string, not a `roles` array. Fall back to that so every
// pre-existing account keeps its access instead of silently losing it —
// apply this to every user record read from KV, not just on login.
function normalizeUser(u) {
  if (Array.isArray(u.roles)) return u;
  return { ...u, roles: u.role ? [u.role] : [] };
}

// Verifies the session token and, if `page` is given, checks the user has
// the admin role or that page in their per-user `pages` grant list. Writes
// the error response itself and returns null on failure so callers can
// just `if (!session) return;`.
async function requireAuth(req, res, { page } = {}) {
  const token = getToken(req);
  const session = verify(token);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return null;
  }
  if (page && !hasRole(session, 'admin')) {
    const pages = session.pages || [];
    if (!pages.includes(page)) {
      sendJson(res, 403, { error: 'Forbidden: no access to this page' });
      return null;
    }
  }
  return session;
}

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function logActivity(session, action, entity, entityId, details) {
  const log = (await kvGet('activity')) || [];
  log.unshift({
    id: genId('act'),
    userId: session.id,
    userName: session.name,
    action,
    entity,
    entityId,
    details: details || null,
    timestamp: Date.now(),
  });
  await kvSet('activity', log.slice(0, 2000));
}

module.exports = { sendJson, getToken, requireAuth, logActivity, genId, hasRole, hasAnyRole, normalizeUser };
