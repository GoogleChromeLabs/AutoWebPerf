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

const Status = require('./common/status');
const {Frequency, FrequencyInMinutes} = require('./common/frequency');
const assert = require('./utils/assert');
const {TestType} = require('./common/types');

/**
 * AutoWebPerf (AWP) main class.
 * Please check README.md for more details of the usage AWP instance.
 *
 * Exmaples of creating a new instance of AWP:
 *   let awp = new AutoWebPerf({
 *     connector: 'JSON',
 *     helper: 'Node',
 *     dataSources: ['webpagetest'],
 *     extensions: extensions,
 *     json: { // Config for JSON connector.
 *       tests: argv['tests'],
 *       results: argv['results'],
 *     },
 *     verbose: verbose,
 *     debug: debug,
 *   });
 */
class AutoWebPerf {
  /**
   * @param {object} awpConfig The overall config object, including sub-configs
   *     for connetor, helpers, gatherers, and extension modules.
   *
   * Mandatory properties:
   * - awpConfig.dataSources {Array<string>} The array of gatherer names.
   *     e.g. ['webpagetest', 'psi']
   * - awpConfig.connector {string} Connector name. E.g. 'json'.
   * - awpConfig.helper {string} Helper name. E.g. 'node'.
   *
   * Sub-configs:
   * - Connector config. E.g. `awpConfig.googlesheets` is the config object for
   *     GoogleSheets connector and extension module.
   * - Extension config. E.g. `awpConfig.budget` is the config object for Budget
   *     extension module.
   */
  constructor(awpConfig) {
    this.debug = awpConfig.debug || false;
    this.verbose = awpConfig.verbose || false;
    this.config = {};

    assert(awpConfig, 'awpConfig is missing');
    assert(awpConfig.dataSources, 'awpConfig.dataSources is missing.');
    assert(awpConfig.connector, 'awpConfig.connector is missing.');
    assert(awpConfig.helper, 'awpConfig.helper is missing.');
    this.awpConfig = awpConfig;

    // Example data sources: ['webpagetest', 'psi']
    this.dataSources = awpConfig.dataSources;

    this.log(`Use helper: ${awpConfig.helper}`);
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

    this.log(`Use connector: ${awpConfig.connector}`);
    let ConnectorClass, connectorName = awpConfig.connector.toLowerCase();
    let connectorConfig = awpConfig[connectorName];

    // The API Keys used by Gatherers are expected to be accessed through
    // Connector, similar to environment variables. E.g. with GoogleSheets,
    // API Keys are stored in Config tab for users to update easily.
    switch (connectorName) {
      case 'json':
        ConnectorClass = require('./connectors/json-connector');
        break;

      case 'googlesheets':
        ConnectorClass = require('./connectors/googlesheets-connector');
        break;

      case 'fake':
        // Do nothing. For testing purpose.
        break;

      default:
        throw new Error(
            `Connector ${awpConfig.connector} is not supported.`);
        break;
    }

    // Get environment varaibles through the Connector.
    this.envVars = {};
    if (ConnectorClass) {
      this.connector = new ConnectorClass(connectorConfig, this.apiHandler);
      this.envVars = this.connector.getEnvVars();
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
        this.extensions[extension] = new ExtensionClass(extConfig,
            this.envVars);
      });
    }

    // Initialize gatherers.
    this.gatherers = {};

    // The frequency of when to write data back via a connector.
    // E.g. batchUpdateBuffer = 10 means for every 10 run or retrieve, it will
    // update the data by calling connector.updateTestList or updateResultList.
    // When batchUpdateBuffer is 0, it will write back after all iteration.
    this.batchUpdateBuffer = awpConfig.batchUpdateBuffer || 0;
  }

  /**
   * Return the singleton gatherer instance with given name.
   * @param {string} name Gatherer name. E.g. 'webpagetest'.
   * @return {object} Gatherer instance.
   */
  getGatherer(name) {
    let options = {
      verbose: this.verbose,
      debug: this.debug,
    };

    // FIXME: Remove the hardcoded require path without breaking RollUp bundle.
    if (!this.gatherers[name]) {
      let GathererClass = null;
      let gathererConfig = this.awpConfig[name] || {};

      switch (name) {
        case 'webpagetest':
          GathererClass = require('./gatherers/webpagetest');
          break;

        case 'psi':
          GathererClass = require('./gatherers/psi');
          break;

        case 'cruxbigquery':
          GathererClass = require('./gatherers/cruxbigquery');
          break;

        case 'cruxapi':
          GathererClass = require('./gatherers/cruxapi');
          break;

        case 'fake':
          // Do nothing, for testing purpose.
          break;

        default:
          throw new Error(`Gatherer ${name} is not supported.`);
          break;
      }
      this.gatherers[name] = new GathererClass(gathererConfig, this.envVars,
          this.apiHandler, options);
    }
    return this.gatherers[name];
  }

  /**
   * Run tests and writes output to results.
   * @param {object} options
   * @return {object} Processed Tests and Results.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async run(options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let extResponse, errors = [];

    let tests = this.connector.getTestList(options);
    this.logDebug(`AutoWebPerf::run with ${tests.length} tests`);

    // Before all runs.
    extResponse = this.runExtensions(extensions, 'beforeAllRuns', {tests: tests}, options);
    errors = errors.concat(extResponse.errors);

    // Run tests.
    let newResults = await this.runTests(tests, options);

    // After all runs.
    extResponse = this.runExtensions(extensions, 'afterAllRuns', {
      tests: tests,
      results: newResults,
    }, options);
    errors = errors.concat(extResponse.errors);

    this.logDebug(`AutoWebPerf::run completed with ${tests.length} tests`);

    return {
      tests: tests,
      results: newResults,
      errors: errors,
    };
  }

  /**
   * Run recurring tests and writes output to results.
   * @param {object} options
   * @return {object} Procssed Tests and Results.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - activateOnly {boolean}: When true, only update the nextTriggerTimestamp
   *     to a Test object without running actual audit.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async recurring(options) {
    options = options || {};
    options.recurring = true;

    let extensions = options.extensions || Object.keys(this.extensions);
    let extResponse, overallErrors = [];
    let testsToUpdate = [], resultsToUpdate = [];
    let newResults = [];
    let nowtime = Date.now();

    // Get recurring Tests that passed nextTriggerTimestamp only.
    let tests = this.connector.getTestList(options);
    tests = tests.filter(test => {
      let recurring = test.recurring;
      return recurring && recurring.frequency &&
          Frequency[recurring.frequency.toUpperCase()];
    });

    // Before all runs.
    extResponse = this.runExtensions(extensions, 'beforeAllRuns', {tests: tests}, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    if (options.activateOnly) {
      this.logDebug(`AutoWebPerf::recurring with ${tests.length} tests, ` +
          `activate only.`);

      // Update next trigger timestamp only.
      tests.forEach(test => {
        // Before each run.
        this.runExtensions(extensions, 'beforeRun', {
          test: test,
          result: null,
        }, options);

        let recurring = test.recurring;
        if (recurring.frequency !== recurring.activatedFrequency) {
          this.logDebug('AutoWebPerf::recurring with activateOnly.');
          this.updateNextTriggerTimestamp(test);
        }

        // After each run with empty result.
        this.runExtensions(extensions, 'afterRun', {
          test: test,
          result: null,
        }, options);
      });

    } else {
      // Filter Tests that have passed nextTriggerTimestamp or haven't set with
      // nextTriggerTimestamp.
      tests = tests.filter(test => {
        let recurring = test.recurring;
        return recurring &&
            (!recurring.nextTriggerTimestamp ||
            recurring.nextTriggerTimestamp <= nowtime);
      });

      this.logDebug(`AutoWebPerf::recurring with ${tests.length} tests`);

      // Run tests and updates next trigger timestamp.
      newResults = await this.runTests(tests, options);

      // Update next trigger timestamp.
      tests.forEach(test => {
        this.updateNextTriggerTimestamp(test);
      });
    }

    // Before all runs.
    extResponse = this.runExtensions(extensions, 'afterAllRuns', {
      tests: tests,
      results: newResults,
    }, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    // Update Tests.
    this.connector.updateTestList(tests, options);

    this.logDebug(`AutoWebPerf::recurring completed with ${tests.length} ` +
        `tests`);

    return {
      tests: tests,
      results: newResults,
      errors: overallErrors,
    };
  }

  /**
   * Retrieve test result for all filtered Results.
   * @param  {object} options
   * @return {object} Procssed Results.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  async retrieve(options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let resultsToUpdate = [], overallErrors = [], extResponse;

    let results = this.connector.getResultList(options);
    extResponse = this.runExtensions(extensions, 'beforeAllRetrieves', [] /* tests */,
        results, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    // Default filter for penging results only.
    if (!options.filters) {
      results = results.filter(result => {
        return result.status !== Status.RETRIEVED;
      });
    }

    this.logDebug('AutoWebPerf::retrieve, results.length=\n', results.length);

    // FIXME: Add batch gathering support.

    let count = 0;
    results.forEach(result => {
      this.log(`Retrieve: id=${result.id}`);
      this.logDebug('AutoWebPerf::retrieve, result=\n', result);

      // Before retriving the result.
      extResponse = this.runExtensions(extensions, 'beforeRetrieve',
          {result: result}, options);
      result.errors = (result.errors || []).concat(extResponse.errors);

      let statuses = [];
      let newResult = result;
      newResult.modifiedTimestamp = Date.now();

      // Interate through all gatherers.
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
      extResponse = this.runExtensions(extensions, 'afterRetrieve',
          {result: newResult}, options);
      newResult.errors = newResult.errors.concat(extResponse.errors);

      // Update overall status.
      newResult.status =  this.getOverallStatus(statuses);

      this.log(`Retrieve: overall status=${newResult.status}`);
      this.logDebug('AutoWebPerf::retrieve, statuses=\n', statuses);
      this.logDebug('AutoWebPerf::retrieve, newResult=\n', newResult);

      resultsToUpdate.push(newResult);

      // Batch update to the connector.
      if (this.batchUpdateBuffer &&
          resultsToUpdate.length >= this.batchUpdateBuffer) {
        this.connector.updateResultList(resultsToUpdate, options);
        this.log(
            `AutoWebPerf::retrieve, batch appends ` +
            `${resultsToUpdate.length} results.`);

        resultsToUpdate = [];
      }
    });

    // Update back to the result list.
    this.connector.updateResultList(resultsToUpdate, options);

    // After retriving all results.
    // FIXME: run the extensions before updating the list back to the connector.
    extResponse = this.runExtensions(extensions, 'afterAllRetrieves',
        {results: results}, options);
    overallErrors = overallErrors.concat(extResponse.errors);

    this.logDebug(`AutoWebPerf::retrieved ${results.length} results.`);

    return {
      results: results,
      errors: overallErrors,
    };
  }

  /**
   * Run a single gatherer and return a detailed response from a gatherer.
   * @param {object} test Test object to run.
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   * @return {type}          description
   */
  async runTests(tests, options) {
    options = options || {};
    let extensions = options.extensions || Object.keys(this.extensions);
    let overrideResults = options.overrideResults;
    let resultsToUpdate = [], allNewResults = [];
    let extResponse;

    // Before each run.
    tests.forEach(test => {
      extResponse = this.runExtensions(extensions, 'beforeRun', {test: test});
      test.errors = extResponse.errors;
    });

    if (options.runByBatch) {
      // Run Tests with Data Sources that uses run batch mode.
      // Note that run batch mode doesn't support batch update to the connector.
      let testResultPairs = tests.map(test => {
        return {
          test: test,
          result: this.createNewResult(test, options),
        };
      });

      // Run all gatherers.
      for(const dataSource of this.dataSources) {
        await this.runGathererInBatch(tests, dataSource, options).then(responseList => {
          if(responseList)
            for (let i = 0; i<testResultPairs.length; i++) {
              testResultPairs[i].result[dataSource] = responseList[i];
            }
        });
      }

      // Update overall status and after each run.
      testResultPairs.forEach(pair => {
        let result = pair.result;

        // Update the overall status.
        let statuses = this.dataSources.map(dataSource => {
          return result[dataSource] ?
              result[dataSource].status : Status.RETRIEVED;
        });
        result.status = this.getOverallStatus(statuses);

        // Collect errors from all gatherers.
        result.errors = this.getOverallErrors(result);

        if (options.debug) {
          console.log(result.errors);
        }

        // After each run in batch.
        extResponse = this.runExtensions(extensions, 'afterRun', {
          test: pair.test,
          result: result,
        });
        result.errors = result.errors.concat(extResponse.errors);

        resultsToUpdate.push(pair.result);
        allNewResults.push(pair.result);
      });

    } else {
      // Run one test at a time and collect metrics from all data sources.
      tests.forEach(test => {
        let statuses = [];

        // Create a dummy Result.
        let newResult = this.createNewResult(test, options);

        // Collect metrics from all data sources.
        this.dataSources.forEach(dataSource =>  {
          if (!test[dataSource]) return;

          let response = this.runGatherer(test, dataSource, options);
          if (response) {
            newResult[dataSource] = response;
            statuses.push(newResult[dataSource].status);
          }
        });

        // Update overall status.
        newResult.status = this.getOverallStatus(statuses);

        // Collect errors from all gatherers.
        newResult.errors = this.getOverallErrors(newResult);

        // After each run
        extResponse = this.runExtensions(extensions, 'afterRun', {
          test: test,
          result: newResult,
        });
        newResult.errors = newResult.errors.concat(extResponse.errors);

        // Collect tests and results for batch update if applicable.
        resultsToUpdate.push(newResult);
        allNewResults.push(newResult);

        // Batch update to the connector if the buffer is full.
        if (this.batchUpdateBuffer &&
            resultsToUpdate.length >= this.batchUpdateBuffer) {
          this.connector.appendResultList(resultsToUpdate, options);
          this.log(`AutoWebPerf::retrieve, batch appends ` +
              `${resultsToUpdate.length} results.`);
          resultsToUpdate = [];
        }
      });
    }

    // Update the remaining.
    this.connector.appendResultList(resultsToUpdate, options);

    return allNewResults;
  }

  /**
   * Run through all extensions.
   * @param {Array<string>} extensions Array of extension names
   * @param {string} functionName The function to execute in the extention.
   * @param {object} context Context object that includes tests and results.
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  runExtensions(extensions, functionName, context, options) {
    let errors = [];

    extensions.forEach(extName => {
      try {
        if (!this.extensions[extName]) return;
        let extension = this.extensions[extName];
        if (extension[functionName]) extension[functionName](context, options);
      } catch (e) {
        if (this.debug) {
          console.error(e.stack);
        }
        errors.push(e);
      }
    });

    return {
      errors: errors
    };
  }

  /**
   * Run a single gatherer and return a detailed response from a gatherer.
   * @param {object} test Test object to run.
   * @param {object} options
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  runGatherer(test, dataSource, options) {
    options = options || {};
    if (!test[dataSource]) return;

    try {
      let gatherer = this.getGatherer(dataSource);
      let response = gatherer.run(test, options);
      return response;

    } catch (error) {
      return {
        status: Status.ERROR,
        statusText: error.stack,
        metadata: {},
        metrics: {},
      }
    }
  }

  /**
   * Run all gatherers and return a detailed response from a gatherer.
   * @param  {type} tests      description
   * @param  {type} dataSource description
   * @param  {type} options    description
   * @return {type}            description
   */
  async runGathererInBatch(tests, dataSource, options) {
    let responseList = [];

    try {
      let gatherer = this.getGatherer(dataSource);

      await gatherer.runBatchAsync(tests, options).then(res => {
        // If there's no response, it means that the specific gatherer doesn't
        // support runBatch. Hence it won't add any corresponding metrics to the
        // Result objects.
        if (!res) return [];
        responseList = res;
        return responseList;
      });

    } catch (error) {
      responseList = tests.map(test => {
        return {
          status: Status.ERROR,
          statusText: error.stack,
          metadata: {},
        };
      });
    }
    return responseList;
  }

  /**
   * Return an empty Result object.
   * @param {object} test Test object to run.
   * @param {object} options
   * @return {objet} An empty Result object.
   */
  createNewResult(test, options) {
    let nowtime = Date.now();

    return {
      id: nowtime + '-' + test.url || test.origin,
      type: options.recurring ? TestType.RECURRING : TestType.SINGLE,
      status: Status.SUBMITTED,
      label: test.label,
      url: test.url,
      origin: test.origin,
      createdTimestamp: nowtime,
      modifiedTimestamp: nowtime,
      errors: test.errors || [],
    };
  }

  /**
   * Return all Test objects.
   * @param {object} options
   * @return {Array<object>} Test objects.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  getTests(options) {
    options = options || {};
    let tests = this.connector.getTestList(options);
    return tests;
  }

  /**
   * Return all Result objects.
   * @param {object} options
   * @return {Array<object>} Result objects.
   *
   * Available options:
   * - filters {Array<string>}: Use `options.filters` to filter
   *     tests that match conditions. See `src/utils/pattern-filter.js` for
   *     more details.
   * - verbose {boolean}: Whether to show verbose messages in terminal.
   * - debug {boolean}: Whether to show debug messages in terminal.
   */
  getResults(options) {
    options = options || {};
    let results = this.connector.getResultList(options);
    return results;
  }

  /**
   * Returns the overall status with given list of Gatherers' statuses.
   * @param {Array<string>} statuses
   * @return {string} Overall status
   */
  getOverallStatus(statuses) {
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

  /**
   * Update the next trigger timestamp to a Test.
   * @param {object} test Test object to run.
   */
  updateNextTriggerTimestamp(test) {
    let nowtime = Date.now();
    let recurring = test.recurring;
    let offset = FrequencyInMinutes[recurring.frequency.toUpperCase()];
    recurring.nextTriggerTimestamp = offset ? nowtime + offset : '';
    recurring.activatedFrequency = recurring.frequency;
  }

  /**
   * Update overall errors to a Result.
   * @param {object} result Result object.
   */
  getOverallErrors(result) {
    let errors = [];

    // Collect errors from all gatherers.
    this.dataSources.forEach(dataSource => {
      if (!result[dataSource]) return;

      if (result[dataSource].status === Status.ERROR) {
        errors.push(result[dataSource].statusText);
      }
      // Add data source prefix to all error messages.
      (result[dataSource].errors || []).forEach(error => {
        errors.push(`[${dataSource}] ` + error)
      });
    });
    return errors.filter(e => e);
  }

  /**
   * Log a message with console.log.
   * @param {string} message
   */
  log(message) {
    if (!this.verbose) return;
    console.log(message);
  }

  /**
   * Log debug message.
   * @param {string} message
   */
  logDebug(message) {
    if (!this.debug) return;
    console.log(message);
  }
}

module.exports = AutoWebPerf;
