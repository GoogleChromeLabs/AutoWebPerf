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

/**
 * The following standardized metric names are based on the performance
 * metrics used in Lighthouse: https://web.dev/performance-scoring/
 */

const assert = require('../utils/assert');
const setObject = require('../utils/set-object');

const MetricKeys = [
  // timing
  'TimeToFirstByte',
  'FirstPaint',
  'FirstMeaningfulPaint',
  'FirstContentfulPaint',
  'VisualComplete',
  'SpeedIndex',
  'DOMContentLoaded',
  'LoadEvent',
  'TimeToInteractive',
  'TotalBlockingTime',
  'FirstCPUIdle',
  'LargestContentfulPaint',
  'CumulativeLayoutShift',
  'FirstInputDelay',
  'TTIMeasurementEnd',

  // resourceSize
  'TotalSize',
  'HTML',
  'Javascript',
  'CSS',
  'UnusedCSS',
  'Fonts',
  'Images',
  'WebPImages',
  'OptimizedImages',
  'ResponsiveImages',
  'OffscreenImages',
  'Videos',
  'Medias',
  'ThirdParty',
  'RenderBlockingResources',

  // resourceCount
  'DOMElements',
  'Connections',
  'Requests',

  // scores and flags
  'Performance',
  'ProgressiveWebApp',
  'Manifest',
  'ServiceWorker',
  'Offline',
  'Accessibility',
  'BestPractices',
  'SEO',

  // tools
  'crux',
  'lighthouse',
  'formFactor',
  'urlType'
];

class Metrics {
  constructor() {
    this.values = {};
  }

  set(key, value) {
    let parts = key.split('.');
    let metricKey = key;
    if (parts.length > 1) metricKey = parts[parts.length -1];

    if (!MetricKeys.includes(metricKey)) {
      throw new Error(`Metric key "${metricKey}" is not supported.`);
    }
    this.setAny(key, value);
  }

  get(key) {
    return eval(`this.values.${key}`);
  }

  setAny(key, value) {
    setObject(this.values, key, value);
  }

  toObject() {
    return this.values;
  }
}

module.exports = {
  MetricKeys: MetricKeys,
  Metrics: Metrics,
}
