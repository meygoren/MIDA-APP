// CRM: buyer accounts. Single-contact-per-account shape (company name,
// contact name/email/phone, business/tax ID, country, preferred payment
// method, deal stage, notes, whatsapp number for click-to-chat links).
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'customers',
  page: 'crm',
  idPrefix: 'cust',
  entityName: 'customer',
});
