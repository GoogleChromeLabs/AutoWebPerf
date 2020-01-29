/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const WPTGatherer = require('./gatherers/wpt-gatherer');
const PSIGatherer = require('./gatherers/psi-gatherer');
const BudgetsExtension = require('./extensions/budgets');
const Status = require('./common/status');
const assert = require('./utils/assert');

const TestType = {
  SINGLE: 'Single',
  RECURRING: 'Recurring',
};

const Frequency = {
  NONE: 'none',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  TEST: 'test',
};

// TODO: May need to use MomemtJS for more accurate date offset.
const FrequencyInMinutes = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  BIWEEKLY: 14 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  TEST: 60 * 1000,
};

class AutoWebPerf {
  constructor(awpConfig) {
    this.debug = awpConfig.debug || false;
    this.verbose = awpConfig.verbose || false;

    assert(awpConfig.dataSources, 'awpConfig.dataSources is missing.');
    assert(awpConfig.connector, 'awpConfig.connector is missing.');
    assert(awpConfig.helper, 'awpConfig.helper is missing.');

    // Example data sources: ['webpagetest', 'psi']
    this.dataSources = awpConfig.dataSources;

    this.log(`Use connector ${awpConfig.connector}`);
    switch (awpConfig.connector.toLowerCase()) {
      case 'json':
        let JSONConnector = require('./connectors/json-connector');
        this.connector = new JSONConnector(awpConfig.json);
        this.apiKeys = this.connector.getConfig().apiKeys;
        break;

      case 'googlesheets':
        assert(awpConfig.googlesheets, 'googlesheets is missing.');
        let GoogleSheetsConnector = require('./connectors/googlesheets-connector');

        // TODO: Standardize awpConfig.
        this.connector = new GoogleSheetsConnector(
            awpConfig.googlesheets);
        this.apiKeys = this.connector.getConfig().apiKeys;
        break;

      case 'fake':
        // Do nothing. For testing purpose.
        break;

      default:
        throw new Error(
            `Connector ${awpConfig.connector} is not supported.`);
        break;
    }

    this.log(`Use helper ${awpConfig.helper}`);
    switch (awpConfig.helper.toLowerCase()) {
      case 'node':
        let {NodeApiHandler} = require('./helpers/node-helper');
        this.apiHandler = new NodeApiHandler();
        break;

      case 'googlesheets':
        let {GoogleSheetsApiHandler} = require('./helpers/googlesheets-helper');
        this.apiHandler = new GoogleSheetsApiHandler();
        break;

      case 'fake':
        // Do nothing. For testing purpose.
        break;

      default:
        throw new Error(
            `Helper ${awpConfig.helper} is not supported.`);
        break;
    }

    this.log(`Use extensions: ${awpConfig.extensions}`);

    // Initialize extensions.
    this.extensions = {};
    if (awpConfig.extensions) {
      awpConfig.extensions.forEach(extension => {
        switch (extension) {
          case 'budgets':
            this.extensions.budgets = new BudgetsExtension(awpConfig.budgets);
            break;

          default:
            throw new Error(
                `Extension ${extension} is not supported.`);
            break;
        }
      });
    }

    // Initialize gatherers.
    this.gatherers = {};

    // The frequency of when to write data back via a connector.
    // E.g. partialUpdate = 10 means for every 10 run or retrieve, it will
    // update the data by calling connector.updateTestList or updateResultList.
    // When partialUpdate is 0, it will write back after all iteration.
    this.partialUpdate = awpConfig.partialUpdate || 0;
  }

  getGatherer(name) {
    let options = {
      verbose: this.verbose,
      debug: this.debug,
    };

    let GathererClass = null;
    switch (name) {
      case 'webpagetest':
        GathererClass = WPTGatherer;
        break;

      case 'psi':
        GathererClass = PSIGatherer;
        break;

      // case 'crux':
      //   break;

      case 'fake':
        // Do nothing, for testing purpose.
        break;

      default:
        throw new Error(`Gatherer ${name} is not supported.`);
        break;
    }

    if (!this.gatherers[name]) {
      this.gatherers[name] = new GathererClass({
          apiKey: this.apiKeys[name],
        },
        this.apiHandler,
        options);
    }
    return this.gatherers[name];
  }

  /**
   * Run selected tests for all tests, and writes output to results.
   * @param  {object} options
   */
  run(options) {
    options = options || {};

    let tests = this.connector.getTestList(options.filters);
    let count = 0;
    let testsToUpdate = [];
    let newResults = [];

    tests.forEach(test => {
      this.logDebug('AutoWebPerf::run, test=\n', test);

      let newResult = this.runTest(test, options);

      // Extensions
      Object.keys(this.extensions).forEach(extName => {
        this.logDebug('AutoWebPerf::run, extName=\n', extName);

        let extension = this.extensions[extName];
        extension.postRun(test, newResult);
      });

      newResults.push(newResult);
      testsToUpdate.push(test);

      this.logDebug('AutoWebPerf::run, newResult=\n', newResult);

      // FIXME: When using JSONConnector, this partial update mechanism will be
      // inefficient.
      count++;
      if (this.partialUpdate && count >= this.partialUpdate) {
        this.connector.updateTestList(testsToUpdate);
        this.connector.appendResultList(newResults);
        this.log(
            `AutoWebPerf::run, partial update ${testsToUpdate.length} tests` +
            ` and appends ${newResults.length} results.`);

        testsToUpdate = [];
        newResults = [];
        count = 0;
      }
    });

    // Update the remaining.
    this.connector.updateTestList(testsToUpdate);
    this.connector.appendResultList(newResults);
  }

  /**
   * Submit recurring tests.
   * @param  {object} options description
   */
  recurring(options) {
    options = options || {};

    let tests = this.connector.getTestList(options);
    let testsToUpdate = [];
    let newResults = [];

    tests = tests.filter(test => {
      let recurring = test.recurring;
      return recurring && recurring.frequency &&
          Frequency[recurring.frequency.toUpperCase()];
    });

    this.logDebug(
        'AutoWebPerf::retrieve, tests.length=\n', tests.length);

    let count = 0;
    tests.forEach(test => {
      this.logDebug('AutoWebPerf::recurring, test=\n', test);

      let nowtime = Date.now();
      let recurring = test.recurring;

      if (options.activateOnly &&
          recurring.frequency !== recurring.activatedFrequency) {
        let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];

        if (!offset) {
          recurring.nextTriggerTimestamp = null;
          recurring.nextTrigger = null;
        } else {
          recurring.nextTriggerTimestamp = nowtime + offset;
          recurring.nextTrigger = new Date(nowtime + offset).toString();
        }
        recurring.activatedFrequency = recurring.frequency;

      } else {
        // Run normal recurring tests.
        if (!recurring.nextTriggerTimestamp ||
            recurring.nextTriggerTimestamp <= nowtime) {

          this.log('Triggered curring...');
          let newResult = this.runTest(test, {
            recurring: true,
          });

          // Extensions
          Object.keys(this.extensions).forEach(extName => {
            let extension = this.extensions[extName];
            extension.postRetrieve(newResult);
          });

          newResults.push(newResult);

          // Update Test item.
          let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];
          recurring.nextTriggerTimestamp = nowtime + offset;
          recurring.nextTrigger = new Date(nowtime + offset).toString();
        }
      }
      testsToUpdate.push(test);

      count++;
      if (this.partialUpdate && count >= this.partialUpdate) {
        this.connector.updateTestList(testsToUpdate);
        this.connector.appendResultList(newResults);
        this.log(
            `AutoWebPerf::recurring, partial update ${testsToUpdate.length} tests` +
            ` and appends ${newResults.length} results.`);

        testsToUpdate = [];
        newResults = [];
        count = 0;

      }
    });

    // Update the remaining.
    this.connector.updateTestList(testsToUpdate);
    this.connector.appendResultList(newResults);
  }

  /**
   * The main function for running a test.
   * @param  {object} test
   * @param  {object} options
   */
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

    this.dataSources.forEach(dataSource => {
      if (!test[dataSource]) return;

      let gatherer = this.getGatherer(dataSource);
      let settings = test[dataSource].settings;
      let response = gatherer.run(test, {} /* options */);
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

  /**
   * Retrieve test result for all result list.
   * @param  {object} options
   */
  retrieve(options) {
    options = options || {};

    let resultsToUpdate = [];
    let results = this.connector.getResultList(options);

    results = results.filter(result => {
      return result.status !== Status.RETRIEVED;
    });

    let count = 0;
    results.forEach(result => {
      this.log(`Retrieve: id=${result.id}`);
      this.logDebug('AutoWebPerf::retrieve, result=\n', result);

      let statuses = [];
      let newResult = result;
      newResult.modifiedTimestamp = Date.now();

      this.dataSources.forEach(dataSource => {
        if (!result[dataSource]) return;
        if (result[dataSource].status === Status.RETRIEVED) return;

        let gatherer = this.getGatherer(dataSource);
        let response = gatherer.retrieve(
            result, {debug: true});

        statuses.push(response.status);
        newResult[dataSource] = response;

        this.log(
            `Retrieve: ${dataSource} result: status=${response.status}`);
      });

      // Extensions
      Object.keys(this.extensions).forEach(extName => {
        let extension = this.extensions[extName];
        extension.postRetrieve(newResult);
      });

      if (statuses.filter(s => s !== Status.RETRIEVED).length === 0) {
        newResult.status = Status.RETRIEVED;
      }

      this.log(`Retrieve: overall status=${newResult.status}`);
      this.logDebug('AutoWebPerf::retrieve, statuses=\n', statuses);
      this.logDebug('AutoWebPerf::retrieve, newResult=\n', newResult);

      resultsToUpdate.push(newResult);

      count++;
      if (this.partialUpdate && count >= this.partialUpdate) {
        this.connector.updateResultList(resultsToUpdate);
        this.log(
            `AutoWebPerf::retrieve, partial appends ` +
            `${resultsToUpdate.length} results.`);

        resultsToUpdate = [];
        count = 0;
      }
    });

    this.connector.updateResultList(resultsToUpdate);
  }

  getTests(options) {
    options = options || {};
    let tests = this.connector.getTestList(options);
    return tests;
  }

  getResults(options) {
    options = options || {};
    let results = this.connector.getResultList(options);
    return results;
  }

  cancel(tests) {
    // TODO
  }

  log(message) {
    if (!this.verbose) return;
    console.log(message);
  }

  logDebug(message) {
    if (!this.debug) return;
    console.log(message);
  }
}

module.exports = AutoWebPerf;
