'use strict';

const request = require('request');
const WPTGatherer = require('./gatherers/wpt-gatherer');
const PSIGatherer = require('./gatherers/psi-gatherer');
const JSONConnector = require('./connectors/json-connector');
const {NodeApiHandler} = require('./helpers/node-helper.js');
const Status = require('./common/status');

const TestType = {
  SINGLE: 'Single',
  RECURRING: 'Recurring',
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
        this.connector = new JSONConnector({
          tests: awpConfig.tests,
          results: awpConfig.results,
        });
        break;

      case 'GoogleSheets':
        break;

      default:
        throw new Error(
            `Connector ${awpConfig.connector} is not supported.`);
        break;
    }

    this.apiHandler = new NodeApiHandler();
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

    tests.map((test) => {
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

      newResults.push(newResult);
    });

    this.connector.appendResultList(newResults);
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
