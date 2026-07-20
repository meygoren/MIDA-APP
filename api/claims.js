// After-Sales / Claims: batch/shipment-level defect claims (not
// serial-number-level) — a buyer reports N defective units out of a
// shipment of Y, with photos, routed to the After-Sales role. Resolution
// is replacement units, a credit note, or a refund.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId, hasAnyRole } = require('./_util');

const STATUSES = ['open', 'in_review', 'resolved', 'closed'];
const RESOLUTION_TYPES = ['replacement', 'credit', 'refund'];
const RESOLVER_ROLES = ['admin', 'aftersales'];

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'claims' });
  if (!session) return;

  const list = (await kvGet('claims')) || [];

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
    const claim = {
      id: genId('claim'),
      claimNumber: `C-${Date.now().toString().slice(-8)}`,
      buyerId: body.buyerId || null,
      quoteId: body.quoteId || null,
      shipmentId: body.shipmentId || null,
      totalUnits: Number(body.totalUnits) || 0,
      defectiveUnits: Number(body.defectiveUnits) || 0,
      description: body.description || '',
      photoDataUrls: Array.isArray(body.photoDataUrls) ? body.photoDataUrls : [],
      status: 'open',
      resolutionType: null,
      resolutionNotes: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: session.id,
    };
    list.unshift(claim);
    await kvSet('claims', list);
    await logActivity(session, 'create', 'claim', claim.id);
    return sendJson(res, 201, claim);
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === body.id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });

    if (body.status && !STATUSES.includes(body.status)) {
      return sendJson(res, 400, { error: `Invalid status. Must be one of: ${STATUSES.join(', ')}` });
    }
    if (body.resolutionType && !RESOLUTION_TYPES.includes(body.resolutionType)) {
      return sendJson(res, 400, { error: `Invalid resolutionType. Must be one of: ${RESOLUTION_TYPES.join(', ')}` });
    }

    const isResolvingAction = (body.status && ['resolved', 'closed'].includes(body.status)) || body.resolutionType;
    if (isResolvingAction && !hasAnyRole(session, RESOLVER_ROLES)) {
      return sendJson(res, 403, { error: 'Only After-Sales/Admin can resolve or close a claim' });
    }

    list[idx] = { ...list[idx], ...body, updatedAt: Date.now() };
    await kvSet('claims', list);
    await logActivity(session, 'update', 'claim', body.id, body.status ? `status -> ${body.status}` : undefined);
    return sendJson(res, 200, list[idx]);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = list.splice(idx, 1);
    await kvSet('claims', list);
    await logActivity(session, 'delete', 'claim', id);
    return sendJson(res, 200, removed);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
