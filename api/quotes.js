// Quotes & Invoices: RFQ-in -> quote-out -> deposit invoice -> balance
// invoice. Line items carry a single negotiated unit price (no
// quantity-break tiers in v1). Currency can be USD/RMB/EUR with a free-text
// FX note for context; totals are kept in the quote's own currency.
const { kvGet, kvSet } = require('./_kv');
const { sendJson, requireAuth, logActivity, genId } = require('./_util');

const STATUSES = [
  'draft',
  'sent',
  'accepted',
  'deposit_paid',
  'in_production',
  'balance_paid',
  'shipped',
  'closed',
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeTotals(lineItems) {
  const items = (lineItems || []).map((li) => ({
    ...li,
    qty: Number(li.qty) || 0,
    unitPrice: Number(li.unitPrice) || 0,
    lineTotal: round2((Number(li.qty) || 0) * (Number(li.unitPrice) || 0)),
  }));
  const subtotal = round2(items.reduce((sum, li) => sum + li.lineTotal, 0));
  return { items, subtotal };
}

function withDeposit(quote, subtotal) {
  const depositPercent = Number(quote.depositPercent) || 0;
  const depositAmount = round2(subtotal * (depositPercent / 100));
  return {
    ...quote,
    subtotal,
    total: subtotal,
    depositPercent,
    depositAmount,
    balanceAmount: round2(subtotal - depositAmount),
  };
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'quotes' });
  if (!session) return;

  const list = (await kvGet('quotes')) || [];

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
    const { items, subtotal } = computeTotals(body.lineItems);
    let quote = {
      id: genId('quote'),
      quoteNumber: `Q-${Date.now().toString().slice(-8)}`,
      buyerId: body.buyerId || null,
      currency: body.currency || 'RMB',
      fxNote: body.fxNote || '',
      lineItems: items,
      depositPercent: body.depositPercent || 0,
      status: 'draft',
      notes: body.notes || '',
      readyByDate: body.readyByDate || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: session.id,
    };
    quote = withDeposit(quote, subtotal);
    list.unshift(quote);
    await kvSet('quotes', list);
    await logActivity(session, 'create', 'quote', quote.id);
    return sendJson(res, 201, quote);
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
    const { items, subtotal } = computeTotals(updated.lineItems);
    updated = withDeposit({ ...updated, lineItems: items }, subtotal);

    list[idx] = updated;
    await kvSet('quotes', list);
    await logActivity(session, 'update', 'quote', body.id, body.status ? `status -> ${body.status}` : undefined);
    return sendJson(res, 200, updated);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query || {};
    if (!id) return sendJson(res, 400, { error: 'id required' });
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) return sendJson(res, 404, { error: 'Not found' });
    const [removed] = list.splice(idx, 1);
    await kvSet('quotes', list);
    await logActivity(session, 'delete', 'quote', id);
    return sendJson(res, 200, removed);
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
};

module.exports.STATUSES = STATUSES;
