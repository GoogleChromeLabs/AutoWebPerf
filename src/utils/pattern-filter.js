/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
