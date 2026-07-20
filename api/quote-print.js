// Server-rendered, print-ready HTML view of a quote/invoice (open in a new
// tab, browser print-to-PDF). Mirrors PrimeCom's quote-print.js pattern.
const { kvGet } = require('./_kv');
const { requireAuth } = require('./_util');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

module.exports = async function handler(req, res) {
  const session = await requireAuth(req, res, { page: 'quotes' });
  if (!session) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  const quotes = (await kvGet('quotes')) || [];
  const quote = quotes.find((q) => q.id === id);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const customers = (await kvGet('customers')) || [];
  const buyer = customers.find((c) => c.id === quote.buyerId);
  const settings = (await kvGet('settings')) || { companyName: 'Wholesale Co.' };

  const rows = (quote.lineItems || [])
    .map(
      (li) => `
    <tr>
      <td>${escapeHtml(li.description)}</td>
      <td style="text-align:right">${li.qty}</td>
      <td style="text-align:right">${quote.currency} ${Number(li.unitPrice).toFixed(2)}</td>
      <td style="text-align:right">${quote.currency} ${Number(li.lineTotal).toFixed(2)}</td>
    </tr>`
    )
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(quote.quoteNumber)}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; padding: 40px; color: #1a1a1a; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { padding: 8px; border-bottom: 1px solid #ddd; font-size: 13px; }
  th { text-align: left; background: #f5f5f5; }
  .totals { margin-top: 16px; text-align: right; }
  .totals div { margin: 4px 0; }
  .meta { display: flex; justify-content: space-between; margin-top: 24px; font-size: 13px; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eef; font-size: 12px; text-transform: uppercase; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(settings.companyName || 'Wholesale Co.')}</h1>
  <div>Quote ${escapeHtml(quote.quoteNumber)} &mdash; <span class="status">${escapeHtml(quote.status)}</span></div>
  <div class="meta">
    <div>
      <strong>Bill To</strong><br>
      ${escapeHtml(buyer ? buyer.companyName : 'N/A')}<br>
      ${escapeHtml(buyer ? buyer.contactName || '' : '')}
    </div>
    <div>
      <strong>Date</strong><br>
      ${new Date(quote.createdAt).toLocaleDateString()}
      ${quote.readyByDate ? `<br><strong>Ready by</strong><br>${escapeHtml(quote.readyByDate)}` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>Subtotal: ${quote.currency} ${Number(quote.subtotal).toFixed(2)}</div>
    ${quote.depositPercent ? `<div>Deposit (${quote.depositPercent}%): ${quote.currency} ${Number(quote.depositAmount).toFixed(2)}</div>` : ''}
    ${quote.depositPercent ? `<div>Balance: ${quote.currency} ${Number(quote.balanceAmount).toFixed(2)}</div>` : ''}
    <div><strong>Total: ${quote.currency} ${Number(quote.total).toFixed(2)}</strong></div>
  </div>
  ${quote.fxNote ? `<div style="margin-top:16px;font-size:12px;color:#666;">FX note: ${escapeHtml(quote.fxNote)}</div>` : ''}
  ${quote.notes ? `<div style="margin-top:16px;font-size:12px;">${escapeHtml(quote.notes)}</div>` : ''}
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
};
