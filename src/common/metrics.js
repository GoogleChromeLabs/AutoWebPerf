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
  'FirstInputDelay',
  'LargestContentfulPaint',

  // resourceSize
  'HTML',
  'Javascript',
  'CSS',
  'Fonts',
  'Images',
  'Videos',

  // resourceCount
  'DOMElements',
  'Connections',
  'Requests',

  // scores
  'Performance',
  'ProgressiveWebApp',
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
