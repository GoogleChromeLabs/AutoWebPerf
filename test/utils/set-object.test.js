/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const setObject = require('../../src/utils/set-object');

describe('setObject test', () => {
  it('sets nested properties to the object.', async () => {
    let newObj = {};

    setObject(newObj, 'a.b.c', 'C');
    expect(newObj).toEqual({
      a: {
        b: {
          c: 'C'
        }
      }
    });

    setObject(newObj, 'a.x', 'X');
    expect(newObj).toEqual({
      a: {
        b: {
          c: 'C'
        },
        x: 'X'
      }
    });
  });

  it('sets non-nested properties to the object.', async () => {
    let newObj = {};

    setObject(newObj, 'a', 'A');
    expect(newObj).toEqual({
      a: 'A',
    });

    setObject(newObj, 'b', 'B');
    expect(newObj).toEqual({
      a: 'A',
      b: 'B',
    });

  });

  it('sets nothing when setting without property path.', async () => {
    let newObj = {};

    setObject(newObj, null, 'A');
    expect(newObj).toEqual({});
  });
});
