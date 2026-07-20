// Product catalog: AC/DC charger specs live under a free-form `attributes`
// object (voltage, amperage, powerKw, connectorType, cordLength, ...) so a
// future product category can define its own attribute set without a
// schema migration.
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'products',
  page: 'products',
  idPrefix: 'prod',
  entityName: 'product',
});
