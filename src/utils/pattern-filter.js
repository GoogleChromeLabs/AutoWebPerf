const assert = require('./assert.js');

/**
 * A powerful filter with string patterns.
 *
 * Examples:
 * filters = ['selected', 'webpatestest.metrics.FCP>3', 'rowIndex===5']
*
 * @param  {Array.<object>} items
 * @param  {Array.<object>} filters
 * @return {Array.<object>}
 */
function universalFilter(items, filters) {
  assert(Array.isArray(items), 'parameter items is not an array.');

  filters = filters || [];
  assert(Array.isArray(filters), 'parameter filters is not an array.');

  filters.forEach(filter => {
    items = items.filter(item => {
      try {
        return eval(`item.${(filter || '').trim()}`);
      } catch (error) {
        return false;
      }
    });
  });
  return items;
}

module.exports = universalFilter;
