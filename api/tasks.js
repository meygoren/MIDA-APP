// Generic assignable task list with due dates.
const { makeCrudHandler } = require('./_crud');

module.exports = makeCrudHandler({
  key: 'tasks',
  page: 'tasks',
  idPrefix: 'task',
  entityName: 'task',
});
