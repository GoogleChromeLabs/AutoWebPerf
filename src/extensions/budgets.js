'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');

class BudgetsExtension extends Extension {
  constructor(config) {
    super();
    config = config || {};
    this.budgetMetricMap = {
      'FCP': ['milliseconds', 'seconds', 'overRatio'],
      'FMP': ['milliseconds', 'seconds', 'overRatio'],
      'SpeedIndex': ['milliseconds', 'seconds', 'overRatio'],
      'TTI': ['milliseconds', 'seconds', 'overRatio'],
      'Javascript': ['KB', 'overRatio'],
      'CSS': ['KB', 'overRatio'],
      'Fonts': ['KB', 'overRatio'],
      'Images': ['KB', 'overRatio'],
      'Videos': ['KB', 'overRatio'],
    };
  }

  afterRun(params) {
    assert(params.test, 'test is missing.');
    assert(params.result, 'result is missing.');
    this.processResult(params.result, params.test.budgets);
  }

  afterRetrieve(params) {
    assert(params.result, 'result is missing.');
    this.processResult(params.result, params.result.budgets);
  }

  processResult(result, budgets) {
    assert(result, 'result is missing.');
    if (!budgets || budgets === {}) return;

    // Use webpagetest as default data source.
    let dataSource = budgets.dataSource || 'webpagetest';
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
            break;

          case 'seconds':
            setObject(resultMetric, `budget.seconds`,
                this.round(budget / 1000, 2));
            break;

          case 'overRatio':
            metricValue = metricValues[metric];
            resultMetric[target] = metricValue ?
                this.round((metricValue - budget) / budget, 4) : null;
            break;

          case 'KB':
            setObject(resultMetric, `budget.KB`, budget);
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
