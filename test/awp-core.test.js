/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const AutoWebPerf = require('../src/awp-core');

describe('AutoWebPerf with node.js and JSON connector', () => {
  it('initializes normally.', async () => {
    let awp = new AutoWebPerf({
      debug: true,
      tests: './test/fakedata/tests.json',
      results: './test/fakedata/results.json',
      connector: 'JSON',
      helper: 'Node',
      dataSources: ['webpagetest'],
    });
  });
});
