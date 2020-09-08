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

const fse = require('fs-extra');
const path = require('path');
const assert = require('../utils/assert');
const Connector = require('./connector');

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 */
class JSONConnector extends Connector {
  constructor(config) {
    super();
    this.testsPath = config.testsPath;
    this.resultsPath = config.resultsPath;
    this.testsJson = null;
    this.resultsJson = null;
  }

  getTestsJson() {
    if (this.testsJson) return this.testsJson;
    assert(this.testsPath, 'testsPath is missing in config.');

    return JSON.parse(fse.readFileSync(path.resolve(`${this.testsPath}`)));
  }

  getResultsJson() {
    if (this.resultsJson) return this.resultsJson;
    assert(this.resultsPath, 'resultsPath is missing in config.');

    let filepath = path.resolve(`${this.resultsPath}`);
    if (fse.existsSync(filepath)) {
      let rawdata = fse.readFileSync(filepath);
      let content = rawdata.toString();
      if (content) {
        return JSON.parse(content);
      }
    }
    return {};
  }

  getEnvVars() {
    let testsJson = this.getTestsJson();
    let envVars = (testsJson || {}).envVars;
    return envVars;
  }

  getTestList(options) {
    let testsJson = this.getTestsJson();

    // Manually add index to all test objects.
    let index = 0;
    testsJson.tests.forEach(test => {
      test.json = {
        index: index++,
      }
    });

    return testsJson.tests;
  }

  updateTestList(newTests) {
    let filepath = path.resolve(`${this.testsPath}`);
    let tests = this.getTestList();

    let rowIndexToTests = {};
    newTests.forEach(newTest => {
      rowIndexToTests[newTest.json.index] = newTest;
    });

    let index = 0;
    let testsToUpdate = [];
    tests.forEach(test => {
      test = rowIndexToTests[index] || test;
      delete test.json;
      testsToUpdate.push(test);
      index++;
    })

    fse.outputFileSync(
      filepath,
      JSON.stringify({
        envVars: this.getEnvVars(),
        tests: testsToUpdate,
      }, null, 2));

    // Reset the tests json cache.
    this.testsJson = null;
  }

  getResultList(options) {
    let results = [];
    try {
      let resultsJson = this.getResultsJson();
      results = resultsJson.results || [];

    } catch (error) {
      console.log(error);

    } finally {
      return results;
    }
  }

  appendResultList(newResults, options) {
    let results = this.getResultList();
    fse.outputFileSync(
      path.resolve(`${this.resultsPath}`),
      JSON.stringify({
        results: results.concat(newResults),
      }, null, 2));

    // Reset the results json cache.
    this.resultsJson = null;
  }

  updateResultList(newResults, options) {
    let results = this.getResultList();
    let idToResults = {};

    newResults.forEach(result => {
      idToResults[result.id] = result;
    });

    results = results.map(result => {
      return idToResults[result.id] || result;
    });

    fse.outputFileSync(
      path.resolve(`${this.resultsPath}`),
      JSON.stringify({
        results: results,
      }, null, 2));

    // Reset the results json cache.
    this.resultsJson = null;
  }
}

module.exports = JSONConnector;
