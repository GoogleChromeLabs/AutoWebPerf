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

const {Metrics} = require('../../src/common/metrics');

describe('Metrics unit test', () => {
  it('validate metric name and set the value.', async () => {
    let metrics = new Metrics();
    metrics.set('SpeedIndex', 3000);
    expect(metrics.toObject()).toEqual({
      'SpeedIndex': 3000,
    });

    metrics.set('FirstContentfulPaint', 1000);
    expect(metrics.toObject()).toEqual({
      'FirstContentfulPaint': 1000,
      'SpeedIndex': 3000,
    });

    try {
      metrics.set('Something', 1000);
    } catch (e) {
      expect(e.message).toEqual('Metric key "Something" is not supported.');
    }
  });
});
