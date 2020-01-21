'use strict';

const WPTGatherer = require('./gatherers/wpt-gatherer');
const PSIGatherer = require('./gatherers/psi-gatherer');
const Status = require('./common/status');

const TestType = {
  SINGLE: 'Single',
  RECURRING: 'Recurring',
};

const Frequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
};

// TODO: May need to use MomemtJS for more accurate date offset.
const FrequencyInMinutes = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  BIWEEKLY: 14 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

const DATA_SOURCES = [
  'webpagetest',
  'psi',
];

// TODO: Put this into env vars, or global vars in Sheets.
const API_KEYS = {
  'webpagetest': 'TEST_API', //'A.33b645010f88e6a09879bf0a55a419b9',
  'psi': 'TEST_API', //'AIzaSyCKpw-t9UzdU9rP_Bqker0nYrVtY4W7nxk',
}

class AutoWebPerf {
  constructor(awpConfig) {
    this.debug = awpConfig.debug || false;

    switch (awpConfig.connector) {
      case 'JSON':
        let JSONConnector = require('./connectors/json-connector');
        this.connector = new JSONConnector({
          tests: awpConfig.tests,
          results: awpConfig.results,
        });
        break;

      case 'GoogleSheets':
        let GoogleSheetsConnector = require('./connectors/googlesheets-connector');

        // TODO: Standardize awConfig.
        this.connector = new GoogleSheetsConnector(
            awpConfig.googleSheetsConfig);
        break;

      default:
        throw new Error(
            `Connector ${awpConfig.connector} is not supported.`);
        break;
    }

    switch (awpConfig.helper) {
      case 'Node':
        let {NodeApiHandler} = require('./helpers/node-helper.js');
        this.apiHandler = new NodeApiHandler();
        break;

      case 'GoogleSheets':
        let {GoogleSheetsApiHandler} = require('./helpers/node-helper.js');
        this.apiHandler = new GoogleSheetsApiHandler();
        break;

      default:
        throw new Error(
            `Helper ${awpConfig.helper} is not supported.`);
        break;
    }
  }

  getGatherer(name) {
    switch (name) {
      case 'webpagetest':
        if (!this.wptGatherer) {
          this.wptGatherer = new WPTGatherer({
            apiKey: API_KEYS[name],
          }, this.apiHandler);
        }
        return this.wptGatherer;
        break;

      case 'psi':
        if (!this.psiGatherer) {
          this.psiGatherer = new PSIGatherer({
            apiKey: API_KEYS[name],
          }, this.apiHandler);
        }
        return this.psiGatherer;
        break;

      case 'crux':
        break;

      default:
        throw new Error(`Gathere ${name} is not supported.`);
        break;
    }
  }

  run() {
    let tests = this.connector.getTestList();
    let newResults = [];

    tests.filter(test => test.selected).map((test) => {
      let newResult = this.runSingleTest(test);
      newResults.push(newResult);
    });

    this.connector.appendResultList(newResults);
  }

  recurring() {
    let tests = this.connector.getTestList();
    let newResults = [];

    let newTests = tests.map(test => {
      let nowtime = Date.now();
      let recurring = test.recurring;
      if (!recurring || !recurring.frequency ||
          !Frequency[recurring.frequency.toUpperCase()]) return test;

      if (!recurring.nextTriggerTimestamp ||
          recurring.nextTriggerTimestamp <= nowtime) {
        console.log('triggered curring...');
        let newResult = this.runSingleTest(test);
        newResults.push(newResult);

        let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];
        recurring.nextTriggerTimestamp = nowtime + offset;
        recurring.nextTrigger = new Date(nowtime + offset).toString();
      }

      return test;
    });

    this.connector.updateTestList(newTests);
    this.connector.appendResultList(newResults);
  }

  runSingleTest(test) {
    let nowtime = Date.now();
    let statuses = [];

    let newResult = {
      status: Status.SUBMITTED,
      label: test.label,
      url: test.url,
      createdTimestamp: nowtime,
      modifiedTimestamp: nowtime,
    }

    DATA_SOURCES.forEach(dataSource => {
      if (!test[dataSource]) return;

      let gatherer = this.getGatherer(dataSource);
      let settings = test[dataSource].settings;
      let response = gatherer.run(test, {
        debug: true,
      });
      statuses.push(response.status);

      newResult[dataSource] = {
        status: response.status,
        metadata: response.metadata,
        settings: test[dataSource].settings,
        metrics: response.metrics,
      }
    });

    if (statuses.filter(s => s !== Status.RETRIEVED).length === 0) {
      newResult.status = Status.RETRIEVED;
    }
    return newResult;
  }

  retrieve(options) {
    let results = this.connector.getResultList();
    results = results.map(result => {
      if (result.status !== Status.RETRIEVED) {
        let statuses = [];
        let newResult = result;
        newResult.modifiedTimestamp = Date.now();

        DATA_SOURCES.forEach(dataSource => {
          if (!result[dataSource]) return;
          if (result[dataSource].status === Status.RETRIEVED) return;

          let gatherer = this.getGatherer(dataSource);
          let response = gatherer.retrieve(
              result, {debug: true});

          statuses.push(response.status);
          newResult[dataSource] = response;
        });

        if (statuses.filter(s => s !== Status.RETRIEVED).length === 0) {
          newResult.status = Status.RETRIEVED;
        }
        return newResult;

      } else {
        return result;
      }
    });

    this.connector.updateResultList(results);
  }

  cancel(tests) {

  }
}

module.exports = AutoWebPerf;
