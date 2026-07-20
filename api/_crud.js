const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId } = require('./_util');

// Generic list-backed CRUD handler for simple data domains (customers,
// products, payments, ...). Domains with extra business logic (quotes)
// implement their own handler instead of using this factory.
function makeCrudHandler({ key, page, idPrefix, entityName }) {
  return async function handler(req, res) {
    const session = await requireAuth(req, res, { page });
    if (!session) return;

    const list = (await kvGet(key)) || [];

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
        ...body,
        id: genId(idPrefix),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdBy: session.id,
      };
      list.unshift(item);
      await kvSet(key, list);
      await logActivity(session, 'create', entityName, item.id);
      return sendJson(res, 201, item);
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      if (!body.id) return sendJson(res, 400, { error: 'id required' });
      const idx = list.findIndex((x) => x.id === body.id);
      if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
      list[idx] = { ...list[idx], ...body, updatedAt: Date.now() };
      await kvSet(key, list);
      await logActivity(session, 'update', entityName, body.id);
      return sendJson(res, 200, list[idx]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return sendJson(res, 400, { error: 'id required' });
      const idx = list.findIndex((x) => x.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
      const [removed] = list.splice(idx, 1);
      await kvSet(key, list);
      await logActivity(session, 'delete', entityName, id);
      return sendJson(res, 200, removed);
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  };
}

module.exports = { makeCrudHandler };
