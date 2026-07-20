// Factory/supplier directory: the analog of PrimeCom's suppliers.js, but
// wholesale-scaled to many factories instead of a few fixed ones.
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'suppliers',
  page: 'procurement',
  idPrefix: 'sup',
  entityName: 'supplier',
});
