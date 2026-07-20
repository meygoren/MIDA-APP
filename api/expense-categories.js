// Custom expense categories staff have chosen to save for reuse, beyond
// the built-in set (travel/meals/shipping/office/other). Anyone with
// expenses page access can add, rename, or remove one — not admin-gated,
// since any staff member submitting an expense may want to manage these.
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

  if (req.method === 'PUT') {
    const oldName = String((req.body || {}).oldName || '').trim();
    const newName = String((req.body || {}).newName || '').trim();
    if (!oldName || !newName) return sendJson(res, 400, { error: 'oldName and newName required' });
    const idx = list.findIndex((c) => c.toLowerCase() === oldName.toLowerCase());
    if (idx === -1) return sendJson(res, 404, { error: 'Category not found' });
    list[idx] = newName;
    await kvSet('expenseCategories', list);

    // Cascade the rename onto existing expenses so historical records and
    // reports keep grouping correctly under the new name.
    const expenses = (await kvGet('expenses')) || [];
    let changed = false;
    expenses.forEach((exp) => {
      if (exp.category && exp.category.toLowerCase() === oldName.toLowerCase()) {
        exp.category = newName;
        changed = true;
      }
    });
    if (changed) await kvSet('expenses', expenses);

    await logActivity(session, 'update', 'expenseCategory', newName, `renamed from "${oldName}"`);
    return sendJson(res, 200, list);
  }

  if (req.method === 'DELETE') {
    const name = String((req.query && req.query.name) || '').trim();
    if (!name) return sendJson(res, 400, { error: 'name required' });
    const idx = list.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    if (idx === -1) return sendJson(res, 404, { error: 'Category not found' });
    list.splice(idx, 1);
    await kvSet('expenseCategories', list);
    await logActivity(session, 'delete', 'expenseCategory', name);
    return sendJson(res, 200, list);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
