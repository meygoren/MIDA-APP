// Read-only aggregated reports, computed on the fly from the existing data
// domains (no separate stored key). Revenue-by-product groups on the line
// item description text since quote line items aren't linked to a
// productId in v1 — an approximation, fine at this data volume.
const { kvGet } = require('./_kv');
const { sendJson, requireAuth } = require('./_util');

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'reports' });
  if (!session) return;
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });

  const [quotes, customers, purchaseOrders, suppliers, expenses] = await Promise.all([
    kvGet('quotes'),
    kvGet('customers'),
    kvGet('purchaseOrders'),
    kvGet('suppliers'),
    kvGet('expenses'),
  ]);

  const quoteList = quotes || [];
  const customerList = customers || [];
  const poList = purchaseOrders || [];
  const supplierList = suppliers || [];
  const expenseList = expenses || [];

  const closedStatuses = new Set(['balance_paid', 'shipped', 'closed']);
  const openStatuses = new Set(['draft', 'sent', 'accepted', 'deposit_paid', 'in_production']);
  const committedPoStatuses = new Set(['ordered', 'in_production', 'ready', 'shipped', 'received']);

  const revenueByBuyer = {};
  const revenueByProduct = {};
  let openPipelineValue = 0;

  quoteList.forEach((q) => {
    if (closedStatuses.has(q.status)) {
      const buyer = customerList.find((c) => c.id === q.buyerId);
      const label = buyer ? buyer.companyName : 'Unknown buyer';
      revenueByBuyer[label] = round2((revenueByBuyer[label] || 0) + (Number(q.total) || 0));
      (q.lineItems || []).forEach((li) => {
        const label2 = li.description || 'Unspecified';
        revenueByProduct[label2] = round2((revenueByProduct[label2] || 0) + (Number(li.lineTotal) || 0));
      });
    }
    if (openStatuses.has(q.status)) {
      openPipelineValue = round2(openPipelineValue + (Number(q.total) || 0));
    }
  });

  const spendBySupplier = {};
  poList.forEach((po) => {
    if (!committedPoStatuses.has(po.status)) return;
    const supplier = supplierList.find((s) => s.id === po.supplierId);
    const label = supplier ? supplier.name : 'Unknown supplier';
    spendBySupplier[label] = round2((spendBySupplier[label] || 0) + (Number(po.totalCost) || 0));
  });

  const expensesByCategory = {};
  let pendingExpensesTotal = 0;
  expenseList.forEach((e) => {
    if (e.status === 'approved') {
      expensesByCategory[e.category] = round2((expensesByCategory[e.category] || 0) + (Number(e.amount) || 0));
    } else if (e.status === 'pending') {
      pendingExpensesTotal = round2(pendingExpensesTotal + (Number(e.amount) || 0));
    }
  });

  return sendJson(res, 200, {
    revenueByBuyer,
    revenueByProduct,
    spendBySupplier,
    expensesByCategory,
    pendingExpensesTotal,
    openPipelineValue,
    openQuoteCount: quoteList.filter((q) => openStatuses.has(q.status)).length,
  });
};
