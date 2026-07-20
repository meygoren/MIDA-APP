// Custom expense categories staff have chosen to save for reuse, beyond
// the built-in set (travel/meals/shipping/office/other). Anyone with
// expenses page access can add one — not admin-gated, since any staff
// member submitting an expense may want to introduce a new category.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity } = require('./_util');

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'expenses' });
  if (!session) return;

  const list = (await kvGet('expenseCategories')) || [];

  if (req.method === 'GET') {
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const name = String((req.body || {}).name || '').trim();
    if (!name) return sendJson(res, 400, { error: 'name required' });
    if (!list.some((c) => c.toLowerCase() === name.toLowerCase())) {
      list.push(name);
      await kvSet('expenseCategories', list);
      await logActivity(session, 'create', 'expenseCategory', name);
    }
    return sendJson(res, 201, list);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
