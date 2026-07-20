// Read-only audit trail (who did what, when). Admin only.
const { kvGet } = require('./_kv');
const { sendJson, requireAuth } = require('./_util');

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, {});
  if (!session) return;
  if (session.role !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const log = (await kvGet('activity')) || [];
  const limit = parseInt((req.query && req.query.limit) || '200', 10);
  return sendJson(res, 200, log.slice(0, limit));
};
