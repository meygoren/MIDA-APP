// Procurement: RFQ -> compare supplier quotes -> purchase order -> track
// lead time. One record per supplier RFQ/PO; creating multiple draft POs
// against different suppliers for the same need is how RFQ comparison
// works in v1 (mark one "ordered", close the rest).
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId } = require('./_util');

const STATUSES = ['rfq', 'quoted', 'ordered', 'in_production', 'ready', 'shipped', 'received', 'cancelled'];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeTotals(items) {
  const normalized = (items || []).map((it) => ({
    ...it,
    qty: Number(it.qty) || 0,
    unitCost: Number(it.unitCost) || 0,
    lineTotal: round2((Number(it.qty) || 0) * (Number(it.unitCost) || 0)),
  }));
  const totalCost = round2(normalized.reduce((sum, it) => sum + it.lineTotal, 0));
  return { items: normalized, totalCost };
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'procurement' });
  if (!session) return;

  const list = (await kvGet('purchaseOrders')) || [];

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
    const { items, totalCost } = computeTotals(body.items);
    const po = {
      id: genId('po'),
      poNumber: `PO-${Date.now().toString().slice(-8)}`,
      supplierId: body.supplierId || null,
      linkedQuoteId: body.linkedQuoteId || null,
      currency: body.currency || 'RMB',
      items,
      totalCost,
      leadTimeDays: Number(body.leadTimeDays) || null,
      readyByDate: body.readyByDate || null,
      status: 'rfq',
      notes: body.notes || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: session.id,
    };
    list.unshift(po);
    await kvSet('purchaseOrders', list);
    await logActivity(session, 'create', 'purchaseOrder', po.id);
    return sendJson(res, 201, po);
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === body.id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });

    if (body.status && !STATUSES.includes(body.status)) {
      return sendJson(res, 400, { error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` });
    }

    let updated = { ...list[idx], ...body, updatedAt: Date.now() };
    const { items, totalCost } = computeTotals(updated.items);
    updated = { ...updated, items, totalCost };

    list[idx] = updated;
    await kvSet('purchaseOrders', list);
    await logActivity(session, 'update', 'purchaseOrder', body.id, body.status ? `status -> ${body.status}` : undefined);
    return sendJson(res, 200, updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = list.splice(idx, 1);
    await kvSet('purchaseOrders', list);
    await logActivity(session, 'delete', 'purchaseOrder', id);
    return sendJson(res, 200, removed);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};

module.exports.STATUSES = STATUSES;
