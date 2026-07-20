// Lightweight logistics tracker: shipment status, carrier, tracking
// number, ETA per order. No Incoterms/customs-doc modeling in v1.
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'shipments',
  page: 'logistics',
  idPrefix: 'ship',
  entityName: 'shipment',
});
