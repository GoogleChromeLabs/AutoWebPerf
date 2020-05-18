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

'use strict';

const patternFilter = require('../../src/utils/pattern-filter');

let items = [{
  selected: true,
  id: 1,
  data: {
    a: 100,
    b: 200,
  }
}, {
  selected: false,
  id: 2,
  data: {
    a: 300,
    b: 100,
    c: 900,
  }
}];

describe('PatternFilter test', () => {
  it('filters array of items based on boolean pattern.', async () => {
    let newItems, expectedItems;

    newItems = patternFilter(items, ['selected']);
    expectedItems = [items[0]];
    expect(newItems).toEqual(expectedItems);

    newItems = patternFilter(items, ['id']);
    expectedItems = items;
    expect(newItems).toEqual(expectedItems);
  });

  it('filters array of items based on conditional value.', async () => {
    let newItems, expectedItems;

    newItems = patternFilter(items, ['id===2']);
    expectedItems = [items[1]];
    expect(newItems).toEqual(expectedItems);

    newItems = patternFilter(items, ['data.a>200']);
    expectedItems = [items[1]];
    expect(newItems).toEqual(expectedItems);

    newItems = patternFilter(items, ['data.c===undefined']);
    expectedItems = [items[0]];
    expect(newItems).toEqual(expectedItems);
  });
});
