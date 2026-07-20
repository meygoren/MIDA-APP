// CRM: buyer accounts. Beyond plain CRUD this domain adds a few
// fumamx.com-inspired patterns, scoped down to the essentials:
// - customerCode: auto-generated, sequential per tenant
// - ownerId: the rep responsible for this account (defaults to creator)
// - group: a coarse segment/tier tag
// - lastFollowUpAt: bumped by the "Log Follow-up" action
// - inOpenSea (computed, not stored): true when unowned or stale past
//   OPEN_SEA_DAYS, surfaced as a claimable pool instead of auto-reassigning
// - additionalContacts: secondary contacts beyond the primary contact
//   fields, since real accounts often have more than one contact person
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId } = require('./_util');

const OPEN_SEA_DAYS = 30;
const OPEN_SEA_MS = OPEN_SEA_DAYS * 24 * 60 * 60 * 1000;

function withComputed(customer) {
  const lastActivity = customer.lastFollowUpAt || customer.createdAt || 0;
  const inOpenSea = !customer.ownerId || (Date.now() - lastActivity > OPEN_SEA_MS);
  return { ...customer, inOpenSea };
}

function nextCustomerCode(list) {
  const n = list.length + 1;
  return `C-${String(n).padStart(5, '0')}`;
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'crm' });
  if (!session) return;

  const list = (await kvGet('customers')) || [];

  if (req.method === 'GET') {
    const { id } = req.query || {};
    if (id) {
      const item = list.find((x) => x.id === id);
      if (!item) return sendJson(res, 404, { error: 'Not found' });
      return sendJson(res, 200, withComputed(item));
    }
    return sendJson(res, 200, list.map(withComputed));
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const customer = {
      ...body,
      id: genId('cust'),
      customerCode: nextCustomerCode(list),
      ownerId: body.ownerId || session.id,
      group: body.group || 'potential',
      lastFollowUpAt: Date.now(),
      additionalContacts: Array.isArray(body.additionalContacts) ? body.additionalContacts : [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: session.id,
    };
    list.unshift(customer);
    await kvSet('customers', list);
    await logActivity(session, 'create', 'customer', customer.id);
    return sendJson(res, 201, withComputed(customer));
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    if (!body.id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === body.id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    list[idx] = { ...list[idx], ...body, updatedAt: Date.now() };
    await kvSet('customers', list);
    await logActivity(session, 'update', 'customer', body.id);
    return sendJson(res, 200, withComputed(list[idx]));
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = list.splice(idx, 1);
    await kvSet('customers', list);
    await logActivity(session, 'delete', 'customer', id);
    return sendJson(res, 200, removed);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};
