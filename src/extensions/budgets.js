'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');

class BudgetsExtension extends Extension {
  constructor(config) {
    super();
    config = config || {};
    this.dataSource = config.budgets.dataSource || 'webpagetest';
    this.budgetMetrics = {
      'FCP': ['ms', 'seconds', 'overRatio'],
      'FMP': ['ms', 'seconds', 'overRatio'],
      'SpeedIndex': ['ms', 'seconds', 'overRatio'],
      'TTI': ['ms', 'seconds', 'overRatio'],
      'Javascript': ['kb', 'overRatio'],
      'CSS': ['kb', 'overRatio'],
      'Fonts': ['kb', 'overRatio'],
      'Images': ['kb', 'overRatio'],
      'Videos': ['kb', 'overRatio'],
    };
  }

  afterRun(params) {
    assert(params.test, 'test is missing.');
    assert(params.result, 'result is missing.');

    let budgets = (params.test.budgets || {}).metrics;
    this.processResult(params.result, budgets);
  }

  afterRetrieve(params) {
    assert(params.result, 'result is missing.');

    let budgets = (params.result.budgets || {}).metrics;
    this.processResult(params.result, budgets);
  }

  processResult(result, budgets) {
    assert(result, 'result is missing.');

    let metricValues = (result[this.dataSource] || {}).metrics;
    if (!budgets || budgets === {} || !metricValues) return;

    result.budgets = {
      metrics: {},
    };

    Object.keys(this.budgetMetrics).forEach(metric => {
      let budget = budgets[metric];
      let targets = this.budgetMetrics[metric];
      if (!budget || budget === {} || !targets) return;

      result.budgets.metrics[metric] = {};
      let resultMetric = result.budgets.metrics[metric];

      targets.forEach(target => {
        switch (target) {
          case 'ms':
            if (!budget.ms && !budget.seconds) return;
            resultMetric[target] = budget.ms || budget.seconds  * 1000;
            break;

          case 'seconds':
            if (!budget.ms && !budget.seconds) return;
            resultMetric[target] = budget.seconds ||
                this.round(budget.ms / 1000, 2);
            break;

          case 'overRatio':
            if (!metricValues) return;
            let metricValue = metricValues[metric];

            if (budget.ms || budget.seconds) {
              let budgetValue = budget.ms || budget.seconds  * 1000;
              resultMetric[target] =
                  this.round((metricValue - budgetValue) / budgetValue, 4);
            };
            if (budget.bytes || budget.kb) {
              let budgetValue = budget.bytes || budget.kb  * 1000;
              resultMetric[target] =
                  this.round((metricValue - budgetValue) / budgetValue, 4);
            };
            break;

          case 'kb':
            if (!budget.kb && !budget.bytes) return;
            resultMetric[target] = budget.kb || this.round(budget.bytes / 1000, 2);
            break;

          case 'bytes':
            if (!budget.kb && !budget.bytes) return;
            resultMetric[target] = budget.bytes || budget.kb * 1000;
            break;

          default:
            throw new Error(`Target ${target} is not supported in BudgetsExtension`);
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
