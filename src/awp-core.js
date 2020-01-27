/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const WPTGatherer = require('./gatherers/wpt-gatherer');
const PSIGatherer = require('./gatherers/psi-gatherer');
const Connector = require('./connectors/connector');
const Status = require('./common/status');
const assert = require('./utils/assert');

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
        assert(awpConfig.googleSheets, 'googleSheets is missing.');
        let GoogleSheetsConnector = require('./connectors/googlesheets-connector');

        // TODO: Standardize awpConfig.
        this.connector = new GoogleSheetsConnector(
            awpConfig.googleSheets);
        break;

      default:
        throw new Error(
            `Connector ${awpConfig.connector} is not supported.`);
        break;
    }

    switch (awpConfig.helper) {
      case 'Node':
        let {NodeApiHandler} = require('./helpers/node-helper');
        this.apiHandler = new NodeApiHandler();
        break;

      case 'GoogleSheets':
        let {GoogleSheetsApiHandler} = require('./helpers/googlesheet-helper');
        this.apiHandler = new GoogleSheetsApiHandler();
        break;

      default:
        throw new Error(
            `Helper ${awpConfig.helper} is not supported.`);
        break;
    }

    this.apiKeys = this.connector.getConfig().apiKeys;
  }

  getGatherer(name) {
    switch (name) {
      case 'webpagetest':
        if (!this.wptGatherer) {
          this.wptGatherer = new WPTGatherer({
            apiKey: this.apiKeys[name],
          },
          this.apiHandler,
          {
            debug: this.debug,
          });
        }
        return this.wptGatherer;
        break;

      case 'psi':
        if (!this.psiGatherer) {
          this.psiGatherer = new PSIGatherer({
            apiKey: this.apiKeys[name],
          },
          this.apiHandler,
          {
            debug: this.debug,
          });
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

  run(options) {
    let tests = this.connector.getTestList();
    let newResults = [];

    tests.filter(test => test.selected).map((test) => {
      let newResult = this.runTest(test, options);
      newResults.push(newResult);
    });

    this.connector.appendResultList(newResults);
  }

  recurring(options) {
    let tests = this.connector.getTestList();
    let newResults = [];

    let newTests = tests.map(test => {
      let nowtime = Date.now();
      let recurring = test.recurring;
      if (!recurring || !recurring.frequency ||
          !Frequency[recurring.frequency.toUpperCase()]) return test;

      if (!recurring.nextTriggerTimestamp ||
          recurring.nextTriggerTimestamp <= nowtime) {

        console.log('Triggered curring...');
        let newResult = this.runTest(test, {
          recurring: true,
        });
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

  runTest(test, options) {
    options = options || {};

    let nowtime = Date.now();
    let statuses = [];

    let newResult = {
      id: nowtime + '-' + test.url,
      type: options.recurring ? TestType.RECURRING : TestType.SINGLE,
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

    // TODO: Update to tests list with webpagetest's lastTestId.
    this.connector.updateResultList(results);
  }

  cancel(tests) {

  }
}

module.exports = AutoWebPerf;
