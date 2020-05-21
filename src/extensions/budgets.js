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

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');

class BudgetsExtension extends Extension {
  constructor(config, envVars) {
    super();
    config = config || {};
    this.envVars = envVars;
    this.defaultDataSource = config.dataSource || 'webpagetest';

    this.budgetMetricMap = {
      'FirstContentfulPaint': ['milliseconds', 'seconds', 'overRatio'],
      'FirstMeaningfulPaint': ['milliseconds', 'seconds', 'overRatio'],
      'SpeedIndex': ['milliseconds', 'seconds', 'overRatio'],
      'TimeToInteractive': ['milliseconds', 'seconds', 'overRatio'],
      'Javascript': ['KB', 'overRatio'],
      'CSS': ['KB', 'overRatio'],
      'Fonts': ['KB', 'overRatio'],
      'Images': ['KB', 'overRatio'],
      'Videos': ['KB', 'overRatio'],
    };
  }

  afterRun(context) {
    assert(context.test, 'test is missing.');

    if (context.result) {
      this.processResult(context.result, context.test.budgets);
    }
  }

  afterRetrieve(context) {
    assert(context.result, 'result is missing.');
    this.processResult(context.result, context.result.budgets);
  }

  processResult(result, budgets) {
    assert(result, 'result is missing.');
    if (!budgets || budgets === {}) return;

    // Use webpagetest as default data source.
    let dataSource = budgets.dataSource || this.defaultDataSource;
    let metricValues = (result[dataSource] || {}).metrics;
    if (!metricValues) metricValues = {};

    result.budgets = {...budgets};
    result.budgets.metrics = {};

    Object.keys(this.budgetMetricMap).forEach(metric => {
      let budget = budgets.budget[metric] || null;
      let targets = this.budgetMetricMap[metric];
      if (!budget || !targets) return;

      result.budgets.metrics[metric] = {};
      let resultMetric = result.budgets.metrics[metric];
      let metricValue;

      targets.forEach(target => {
        switch (target) {
          case 'milliseconds':
            setObject(resultMetric, `budget.milliseconds`, budget);
            setObject(resultMetric, `metric.milliseconds`, metricValues[metric]);
            break;

          case 'seconds':
            setObject(resultMetric, `budget.seconds`,
                this.round(budget / 1000, 2));
            setObject(resultMetric, `metric.seconds`,
                this.round(metricValues[metric] / 1000, 2));
            break;

          case 'overRatio':
            metricValue = metricValues[metric];
            resultMetric[target] = metricValue ?
                this.round((metricValue - budget) / budget, 2) : null;
            break;

          case 'KB':
            setObject(resultMetric, `budget.KB`, budget);
            setObject(resultMetric, `metric.KB`, metricValues[metric]);
            break;

          case 'bytes':
            setObject(resultMetric, `budget.bytes`, budget * 1000);
            break;

          default:
            throw new Error(
                `Target ${target} is not supported in BudgetsExtension`);
            break;
        }
      });
    });
  }

  round(num, precision) {
    if (!num) return null;
    if (!precision) return Math.round(num);

    let base = 10 ** Math.floor(precision);
  	if (!base) return num;

  	return Math.round(num * base) / base;
  };
}

module.exports = BudgetsExtension;
