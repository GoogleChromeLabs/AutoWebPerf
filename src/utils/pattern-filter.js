const assert = require('./assert.js');

/**
 * A powerful filter with string patterns.
 *
 * For example, with the array like below, the PatternFilter will return only
 * the element with id=’A’.
 *
 * Example:
 *
 *   let items = [
 *      {id: ‘A’},
 *      {id: ‘B’},
 *   ];
 *   patternFilter(items, [‘id=”A”’]); // Filter the element with id=’A’
 *
 * You can also assign multiple conditions matching like below:
 * Example:
 *
 *   let array = [
 *      {id: ‘A’, value:200, selected:true},
 *      {id: ‘B’, value:500, selected:true},
 *   ];
 *   let filters = ['selected', value>300'];
 *   // Filter the element with selected=true, and value > 300.
 *   patternFilter(items, filters);
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
