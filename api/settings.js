// Single settings object (not a list): company info, default currency,
// notification recipients. Any authenticated user can read; only admins
// can write.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity } = require('./_util');

const DEFAULT_SETTINGS = {
  companyName: 'Wholesale Co.',
  defaultCurrency: 'USD',
  notificationEmails: [],
};

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, {});
  if (!session) return;

  if (req.method === 'GET') {
    const settings = (await kvGet('settings')) || DEFAULT_SETTINGS;
    return sendJson(res, 200, settings);
  }

  if (req.method === 'PUT') {
    if (session.role !== 'admin') return sendJson(res, 403, { error: 'Admin only' });
    const current = (await kvGet('settings')) || DEFAULT_SETTINGS;
    const updated = { ...current, ...(req.body || {}) };
    await kvSet('settings', updated);
    await logActivity(session, 'update', 'settings', 'global');
    return sendJson(res, 200, updated);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
