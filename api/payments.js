// Payment ledger: one or more payments (deposit, balance, ...) against a
// quote/invoice. method: wire | escrow | card. status: pending | received |
// released (escrow-specific).
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'payments',
  page: 'payments',
  idPrefix: 'pay',
  entityName: 'payment',
});
