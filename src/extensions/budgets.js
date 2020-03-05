'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');

class BudgetsExtension extends Extension {
  constructor(config) {
    super();
    config = config || {};
    this.defaultDataSource = config.dataSource || 'webpagetest';

    this.budgetMetricMap = {
      'FirstContentfulPaint': ['milliseconds', 'seconds', 'metricValue', 'overRatio'],
      'FirstMeaningfulPaint': ['milliseconds', 'seconds', 'metricValue', 'overRatio'],
      'SpeedIndex': ['milliseconds', 'seconds', 'metricValue', 'overRatio'],
      'TimeToInteractive': ['milliseconds', 'seconds', 'metricValue', 'overRatio'],
      'Javascript': ['KB', 'metricValue', 'overRatio'],
      'CSS': ['KB', 'metricValue', 'overRatio'],
      'Fonts': ['KB', 'metricValue', 'overRatio'],
      'Images': ['KB', 'metricValue', 'overRatio'],
      'Videos': ['KB', 'metricValue', 'overRatio'],
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
          case 'metricValue':
            resultMetric[target] = metricValues[metric];
            break;

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
                this.round((metricValue - budget) / budget, 2) : null;
            break;

          case 'KB':
            setObject(resultMetric, `budget.KB`, budget);
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
