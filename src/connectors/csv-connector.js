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

const fs = require('fs-extra');
const path = require('path');
const parse = require('csv-parse/lib/sync');
const jsonexport = require('jsonexport');
const assert = require('../utils/assert');
const setObject = require('../utils/set-object');
const Connector = require('./connector');

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 */
class CSVConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);
  }

  /**
   * Reading CSV file and converts to nested JSON objects.
   * @param  {string} filename
   * @return {Object} JSON object with nested properties.
   */
  readCsv(filename) {
    if (this.debug) {
      console.log('reading csv file: ' + filename);
    }

    if (fs.existsSync(filename)) {
      let fileContent = fs.readFileSync(filename);
      let data = parse(fileContent, {
        columns: true,
        relax_column_count: true,
      });
      return this.convertJson(data);

    } else {
      return null;
    }
  }

  /**
   * Writing objects to a CSV file.
   * @param  {string} filename
   */
  writeCsv(filename, data) {
    if (this.debug) {
      console.log('writing to csv file: ' + filename);
    }

    // Remove csv-specific metadata.
    data.forEach(item => {
      delete item.csv;
    });
    
    jsonexport(data, function(err, csv){
      if (err) {
        throw new Error(err);
      }
      fs.writeFileSync(filename, csv);
    });
  }

  /**
   * Convert flat object to nested properties.
   * @param  {Array<Object>} Array of objects.
   * @return {Array<Object>} JSON object with nested properties.
   */
  convertJson(data) {
    (data || []).forEach(item => {
      Object.keys(item).forEach(key => {
        if(key.match(/\./)) {
          setObject(item, key, item[key]);
          delete item[key];
        }
      })
    });
    return data;
  }

  /**
   * Get the Test list.
   * @return {Array<Object>} Array of Test objects.
   */
  getTests() {
    if (this.tests) return this.tests;
    assert(this.testsPath, 'testsPath is not defined.');

    if (!fs.existsSync(this.testsPath)) {
      throw new Error(`File "${this.testsPath}" not found.`);
    }

    let tests = this.readCsv(this.testsPath);
    assert(tests && tests.length > 0, `No tests found in ${this.testsPath}.`);
    return tests;
  }

  /**
   * Get the Result list.
   * @return {Array<Object>} Array of Result objects.
   */
  getResults() {
    if (this.results) return this.results;
    assert(this.resultsPath, 'resultsPath is not defined.');

    let results = this.readCsv(this.resultsPath);
    return results || [];
  }

  /**
   * Return EnvVars set.
   * @return {Object} EnvVars object.
   */
  getEnvVars() {
    return this.envVars;
  }

  /**
   * Get all tests.
   * @param  {Object} options
   * @return {Array<Object>} Array of Test objects.
   */
  getTestList(options) {
    let tests = this.getTests();

    // Manually add index to all test objects.
    let index = 0;
    tests.forEach(test => {
      test.csv = {
        index: index++,
      }
    });

    return tests;
  }

  /**
   * Update tests with the given new test objects.
   * @param {Array<Object>} Array of new Test objects.
   * @param  {Object} options
   */
  updateTestList(newTests, options) {
    let filepath = path.resolve(this.testsPath);
    let tests = this.getTestList();

    let rowIndexToTests = {};
    newTests.forEach(newTest => {
      rowIndexToTests[newTest.csv.index] = newTest;
    });

    let index = 0;
    let testsToUpdate = [];
    tests.forEach(test => {
      test = rowIndexToTests[index] || test;
      delete test.csv;
      testsToUpdate.push(test);
      index++;
    })

    this.writeCsv(this.testsPath, testsToUpdate);

    // Reset the tests cache.
    this.tests = null;
  }

  /**
   * Get all results.
   * @param  {Object} options
   * @return {Array<Object>} Array of Result objects.
   */
  getResultList(options) {
    let results;
    try {
      results = this.getResults();

    } catch (error) {
      console.log(error);

    } finally {
      return results || [];
    }
  }

  /**
   * Append results to the existing result list.
   * @param {Array<Object>} newResults Array of new Result objects.
   * @param {Object} options
   */
  appendResultList(newResults, options) {
    options = options || {};
    let results = options.overrideResults ? [] : this.getResultList();

    if (this.debug) {
      console.log(`Appending ${newResults.length} results to the existing ` +
          `file at ${this.resultsPath}`);
    }
    this.writeCsv(this.resultsPath, results.concat(newResults));

    // Reset the results json cache.
    this.results = null;
  }

  /**
   * Override results to the existing result list.
   * @param {Array<Object>} newResults Array of new Result objects.
   * @param {Object} options
   */
  updateResultList(newResults, options) {
    let results = this.getResultList();
    let idToResults = {};

    newResults.forEach(result => {
      idToResults[result.id] = result;
    });

    results = results.map(result => {
      return idToResults[result.id] || result;
    });

    this.writeCsv(this.resultsPath, results);

    // Reset the results json cache.
    this.results = null;
  }
}

module.exports = CSVConnector;
