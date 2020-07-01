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
    this.debug = config.debug || false;
    this.envVars = envVars;

    this.budgetMetricMap = {
      'FirstContentfulPaint': ['milliseconds', 'seconds', 'overRatio'],
      'FirstMeaningfulPaint': ['milliseconds', 'seconds', 'overRatio'],
      'LargestContentfulPaint': ['milliseconds', 'seconds', 'overRatio'],
      'TotalBlockingTime': ['milliseconds', 'seconds', 'overRatio'],
      'SpeedIndex': ['milliseconds', 'seconds', 'overRatio'],
      'TimeToInteractive': ['milliseconds', 'seconds', 'overRatio'],
      'FirstInputDelay': ['milliseconds', 'seconds', 'overRatio'],
      'Javascript': ['KB', 'overRatio'],
      'CSS': ['KB', 'overRatio'],
      'Fonts': ['KB', 'overRatio'],
      'Images': ['KB', 'overRatio'],
      'Videos': ['KB', 'overRatio'],
      'ThirdParty': ['KB', 'overRatio'],
      'Performance': ['numberic', 'overRatio'],
      'CumulativeLayoutShift': ['numberic', 'overRatio'],
    };
  }

  afterRun(context) {
    assert(context.test, 'test is missing.');

    // Adding budgets object to result.
    if (!context.result.budgets) {
      context.result.budgets = context.test.budgets;
    }

    if (context.result && context.result.status === Status.RETRIEVED) {
      this.processResult(context.result, context.result.budgets);
    }
  }

  afterRetrieve(context) {
    assert(context.result, 'result is missing.');

    if (context.result && context.result.status === Status.RETRIEVED) {
      this.processResult(context.result, context.result.budgets);
    }
  }

  processResult(result, budgets) {
    assert(result, 'result is missing.');
    if (!budgets || budgets === {}) return;

    assert(budgets.budget, '"budget" is not defined in the budgets property.');

    let errors = [];
    result.budgets = {...budgets};
    result.budgets.metrics = {};

    Object.keys(this.budgetMetricMap).forEach(metric => {
      let budget = budgets.budget[metric] || null;
      let targets = this.budgetMetricMap[metric];
      if (!budget || !targets) return;

      result.budgets.metrics[metric] = {};

      // Skip the budget calculation if metricPath is not defined.
      // Sample metricPath:
      // - 'webpagetest.metrics.lighthouse.[METRIC_NAME]',
      // - 'psi.metrics.crux.[METRIC_NAME].good'
      let metricPath = result.budgets.metricPath;
      if (!metricPath) return;

      try {
        let resultMetric = result.budgets.metrics[metric];
        let metricValue, actualMetricPath;
        actualMetricPath = metricPath.replace('[METRIC_NAME]', metric);
        metricValue = eval(`result.${actualMetricPath}`);

        targets.forEach(target => {
          switch (target) {
            case 'numberic':
              setObject(resultMetric, `budget.numberic`, budget);
              setObject(resultMetric, `metric.numberic`, metricValue);
              break;

            case 'milliseconds':
              setObject(resultMetric, `budget.milliseconds`, budget);
              setObject(resultMetric, `metric.milliseconds`, metricValue);
              break;

            case 'seconds':
              setObject(resultMetric, `budget.seconds`,
                  this.round(budget / 1000, 2));
              setObject(resultMetric, `metric.seconds`,
                  this.round(metricValue / 1000, 2));
              break;

            case 'overRatio':
              resultMetric[target] = metricValue ?
                  this.round((metricValue - budget) / budget, 4) : null;
              break;

            case 'KB':
              setObject(resultMetric, `budget.KB`, budget);
              setObject(resultMetric, `metric.KB`, metricValue);
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

      } catch (e) {
        if (this.debug) console.error(e);

        let message = `[Budgets] Unable to get metric value for ${metric} ` +
            `with path: ${metricPath}`;
        result.errors = (result.errors || []).concat(message);
      }
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
