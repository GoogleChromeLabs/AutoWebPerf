/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

'use strict';

const Status = require('./common/status');
const {Frequency, FrequencyInMinutes} = require('./common/frequency');
const assert = require('./utils/assert');
const {TestType} = require('./common/types');

class AutoWebPerf {
  constructor(awpConfig) {
    this.debug = awpConfig.debug || false;
    this.verbose = awpConfig.verbose || false;

    assert(awpConfig.dataSources, 'awpConfig.dataSources is missing.');
    assert(awpConfig.connector, 'awpConfig.connector is missing.');
    assert(awpConfig.helper, 'awpConfig.helper is missing.');

    // Example data sources: ['webpagetest', 'psi']
    this.dataSources = awpConfig.dataSources;

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

    this.log(`Use connector ${awpConfig.connector}`);
    let ConnectorClass, connectorName = awpConfig.connector.toLowerCase();
    let connectorConfig = awpConfig[connectorName];

    switch (connectorName) {
      case 'json':
        ConnectorClass = require('./connectors/json-connector');
        this.connector = new ConnectorClass(connectorConfig, this.apiHandler);
        this.apiKeys = this.connector.getConfig().apiKeys;
        break;

      case 'googlesheets':
        ConnectorClass = require('./connectors/googlesheets-connector');
        this.connector = new ConnectorClass(connectorConfig, this.apiHandler);
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

    this.log(`Use extensions: ${awpConfig.extensions}`);

    // Initialize extensions.
    this.extensions = {};
    if (awpConfig.extensions) {
      awpConfig.extensions.forEach(extension => {
        let ExtensionClass;
        let extConfig = awpConfig[extension] || {};

        // Adding mandatory properties.
        extConfig.connector = this.connector;
        extConfig.apiHandler = this.apiHandler;
        extConfig.debug = this.debug;

        switch (extension) {
          case 'budgets':
            ExtensionClass = require('./extensions/budgets');
            break;

          case 'googlesheets':
            ExtensionClass = require('./extensions/googlesheets-extension');
            break;

          default:
            throw new Error(
                `Extension ${extension} is not supported.`);
            break;
        }
        this.extensions[extension] = new ExtensionClass(extConfig);
      });
    }

    // Initialize gatherers.
    this.gatherers = {};

    // The frequency of when to write data back via a connector.
    // E.g. batchUpdate = 10 means for every 10 run or retrieve, it will
    // update the data by calling connector.updateTestList or updateResultList.
    // When batchUpdate is 0, it will write back after all iteration.
    this.batchUpdate = awpConfig.batchUpdate || 0;
  }

  getGatherer(name) {
    let options = {
      verbose: this.verbose,
      debug: this.debug,
    };

    // FIXME: Remove the hardcoded require path without breaking RollUp bundle.
    if (!this.gatherers[name]) {
      let GathererClass = null;
      switch (name) {
        case 'webpagetest':
          GathererClass = require('./gatherers/webpagetest');
          break;

        case 'psi':
          GathererClass = require('./gatherers/psi');
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
    let testsToUpdate = [], resultsToUpdate = [], newResults = [];
    let extensions = options.extensions || Object.keys(this.extensions);

    let count = 0;
    let tests = this.connector.getTestList(options);
    this.runExtensions(extensions, 'beforeAllRuns', tests, [] /* results */);

    tests.forEach(test => {
      this.logDebug('AutoWebPerf::run, test=\n', test);
      this.runExtensions(extensions, 'beforeRun', {test: test});

      // Only run test when URL is defined.
      // TODO: Throw error back.
      if (!test.url) return;

      // Run test.
      let newResult = this.runTest(test, options);
      this.runExtensions(extensions, 'afterRun', {
          test: test,
          result: newResult
      });

      newResults.push(newResult);
      resultsToUpdate.push(newResult);
      testsToUpdate.push(test);

      this.logDebug('AutoWebPerf::run, newResult=\n', newResult);

      // FIXME: When using JSONConnector, this batch update mechanism will be
      // inefficient.
      count++;
      if (this.batchUpdate && count >= this.batchUpdate) {
        this.connector.updateTestList(testsToUpdate);
        this.connector.appendResultList(resultsToUpdate);
        this.log(
            `AutoWebPerf::run, batch update ${testsToUpdate.length} tests` +
            ` and appends ${resultsToUpdate.length} results.`);

        testsToUpdate = [];
        resultsToUpdate = [];
        count = 0;
      }
    });

    // Update the remaining.
    this.connector.updateTestList(testsToUpdate);
    this.connector.appendResultList(resultsToUpdate);

    // After all runs.
    this.runExtensions(extensions, 'afterAllRuns', {
      tests: tests,
      results: newResults,
    });
  }

  /**
   * Submit recurring tests.
   * @param  {object} options description
   */
  recurring(options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let testsToUpdate = [], resultsToUpdate = [];
    let newResults = [];

    let tests = this.connector.getTestList(options);
    tests = tests.filter(test => {
      let recurring = test.recurring;
      return recurring && recurring.frequency &&
          Frequency[recurring.frequency.toUpperCase()];
    });

    this.logDebug('AutoWebPerf::retrieve, tests.length=\n', tests.length);
    this.runExtensions(extensions, 'beforeAllRuns', {tests: tests});

    let count = 0;
    tests.forEach(test => {
      this.logDebug('AutoWebPerf::recurring, test=\n', test);
      this.runExtensions(extensions, 'beforeRun', {test: test});

      let nowtime = Date.now();
      let recurring = test.recurring;

      if (options.activateOnly &&
          recurring.frequency !== recurring.activatedFrequency) {
        this.logDebug('AutoWebPerf::recurring with activateOnly.');

        let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];
        if (!offset) {
          recurring.nextTriggerTimestamp = '';
        } else {
          recurring.nextTriggerTimestamp = nowtime + offset;
        }
        recurring.activatedFrequency = recurring.frequency;

        // Run extension with empty result.
        this.runExtensions(extensions, 'afterRun', {
          test: test,
          result: null,
        });

      } else {
        // Run normal recurring tests.
        if (!recurring.nextTriggerTimestamp ||
            recurring.nextTriggerTimestamp <= nowtime) {

          this.log('AutoWebPerf::Triggered recurring.');

          // Run all recurring tests.
          let newResult = this.runTest(test, {
            recurring: true,
          });
          this.runExtensions(extensions, 'afterRun', {
            test: test,
            result: newResult,
          });

          newResults.push(newResult);
          resultsToUpdate.push(newResult);

          // Update Test item.
          let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];
          recurring.nextTriggerTimestamp = nowtime + offset;

          this.logDebug('AutoWebPerf::retrieve, newResult=\n', newResult);
        }
      }
      testsToUpdate.push(test);
      this.logDebug('AutoWebPerf::retrieve, test=\n', test);

      count++;
      if (this.batchUpdate && count >= this.batchUpdate) {
        this.connector.updateTestList(testsToUpdate);
        this.connector.appendResultList(resultsToUpdate);
        this.log(
            `AutoWebPerf::recurring, batch update ${testsToUpdate.length} tests` +
            ` and appends ${resultsToUpdate.length} results.`);

        testsToUpdate = [];
        resultsToUpdate = [];
        count = 0;
      }
    });

    // Update the remaining.
    this.connector.updateTestList(testsToUpdate);
    this.connector.appendResultList(resultsToUpdate);

    // After all runs.
    this.runExtensions(extensions, 'afterAllRuns', {
      tests: tests,
      results: newResults,
    });
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

      try {
        let gatherer = this.getGatherer(dataSource);
        let settings = test[dataSource].settings;
        let response = gatherer.run(test, {} /* options */);
        statuses.push(response.status);
        newResult[dataSource] = {
          status: response.status,
          statusText: response.statusText,
          metadata: response.metadata,
          settings: test[dataSource].settings,
          metrics: response.metrics,
          errors: response.errors,
        };

      } catch (error) {
        newResult[dataSource] = {
          status: Status.ERROR,
          statusText: error,
          settings: test[dataSource].settings,
          metadata: {},
          metrics: {},
        }
      }
    });

    // Update overall status.
    newResult.status =  this.updateOverallStatus(statuses);
    return newResult;
  }

  /**
   * Retrieve test result for all result list.
   * @param  {object} options
   */
  retrieve(options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let resultsToUpdate = [];

    let results = this.connector.getResultList(options);
    this.runExtensions(extensions, 'beforeAllRetrieves', [] /* tests */, results);

    // Default filter for penging results only.
    if (!options.filters) {
      results = results.filter(result => {
        return result.status !== Status.RETRIEVED;
      });
    }

    let count = 0;
    results.forEach(result => {
      this.log(`Retrieve: id=${result.id}`);
      this.logDebug('AutoWebPerf::retrieve, result=\n', result);

      this.runExtensions(extensions, 'beforeRetrieve', {result: result});

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

        this.log(`Retrieve: ${dataSource} result: status=${response.status}`);
      });

      // After retrieving the result.
      this.runExtensions(extensions, 'afterRetrieve', {result: newResult});

      // Update overall status.
      newResult.status =  this.updateOverallStatus(statuses);

      this.log(`Retrieve: overall status=${newResult.status}`);
      this.logDebug('AutoWebPerf::retrieve, statuses=\n', statuses);
      this.logDebug('AutoWebPerf::retrieve, newResult=\n', newResult);

      resultsToUpdate.push(newResult);

      count++;
      if (this.batchUpdate && count >= this.batchUpdate) {
        this.connector.updateResultList(resultsToUpdate);
        this.log(
            `AutoWebPerf::retrieve, batch appends ` +
            `${resultsToUpdate.length} results.`);

        resultsToUpdate = [];
        count = 0;
      }
    });

    this.connector.updateResultList(resultsToUpdate);
    this.runExtensions(extensions, 'afterAllRetrieves', {results: results});
  }

  /**
   * Run through all extensions
   * @param  {object} options
   */
  runExtensions(extensions, functionName, params) {
    extensions.forEach(extName => {
      if (!this.extensions[extName]) return;
      let extension = this.extensions[extName];
      if (extension[functionName]) extension[functionName](params);
    });
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

  updateOverallStatus(statuses) {
    // The overall status depends on the aggregation of all data sources.
    // If all data sources returne retrieved, the overall status is retrieved.
    // If any of the data source return error, the overall status is error.
    // Otherwise, it's pending.
    if (statuses.filter(s => s === Status.RETRIEVED).length === statuses.length) {
      return Status.RETRIEVED;
    } else if (statuses.filter(s => s === Status.ERROR).length > 0) {
      return Status.ERROR;
    } else {
      return Status.SUBMITTED;
    }
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
