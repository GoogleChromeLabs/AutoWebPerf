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

const flattenObject = require('../../src/utils/flatten-object');

describe('flattenObject test', () => {
  it('flattens an object to one-level properties.', async () => {
    let newObj;
    newObj = flattenObject({
      a: {
        a1: 'A1',
      },
      b: {
        b1: 'B1',
        b2: 'B2',
      },
      c: 'C1',
    });
    expect(newObj).toEqual({
      'a.a1': 'A1',
      'b.b1': 'B1',
      'b.b2': 'B2',
      c: 'C1',
    });

    newObj = flattenObject({
      a: {
        a1: {
          a12: 'A12',
          a13: 'A13',
        },
      },
      b: {
        b1: 'B1',
        b2: 'B2',
      },
      c: 'C1',
    });
    expect(newObj).toEqual({
      'a.a1.a12': 'A12',
      'a.a1.a13': 'A13',
      'b.b1': 'B1',
      'b.b2': 'B2',
      c: 'C1',
    });
 
    newObj = flattenObject({
      a: {
        a1: {
          a12: {
            a123: 'A123',
            a124: 'A124',
          }
        },
      },
      b: {
        b1: 'B1',
        b2: 'B2',
      },
      c: 'C1',
    });
    expect(newObj).toEqual({
      'a.a1.a12.a123': 'A123',
      'a.a1.a12.a124': 'A124',
      'b.b1': 'B1',
      'b.b2': 'B2',
      c: 'C1',
    });    
  });
});