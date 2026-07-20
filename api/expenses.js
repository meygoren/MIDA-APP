// Staff expense capture: photo (stored as a data URL — fine at this scale,
// no blob storage wired up) + category + approval. Anyone with page access
// can submit; only admin/finance can approve or reject.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId, hasAnyRole } = require('./_util');

const APPROVER_ROLES = ['admin', 'finance'];

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'expenses' });
  if (!session) return;

  const list = (await kvGet('expenses')) || [];

  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (id) {
      const item = list.find((x) => x.id === id);
      if (!item) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, item);
    }
    return sendJson(res, 200, list);
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const item = {
      id: genId('exp'),
      category: body.category || 'other',
      amount: Number(body.amount) || 0,
      currency: body.currency || 'RMB',
      description: body.description || '',
      date: body.date || null,
      photoDataUrl: body.photoDataUrl || null,
      status: 'pending',
      submittedBy: session.id,
      submittedByName: session.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.unshift(item);
    await kvSet('expenses', list);
    await logActivity(session, 'create', 'expense', item.id);
    return sendJson(res, 201, item);
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === body.id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });

    if (body.status && ['approved', 'rejected'].includes(body.status) && !hasAnyRole(session, APPROVER_ROLES)) {
      return sendJson(res, 403, { error: 'Only Finance/Admin can approve or reject expenses' });
    }

    list[idx] = { ...list[idx], ...body, updatedAt: Date.now() };
    await kvSet('expenses', list);
    await logActivity(session, 'update', 'expense', body.id, body.status ? `status -> ${body.status}` : undefined);
    return sendJson(res, 200, list[idx]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = list.splice(idx, 1);
    await kvSet('expenses', list);
    await logActivity(session, 'delete', 'expense', id);
    return sendJson(res, 200, removed);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
