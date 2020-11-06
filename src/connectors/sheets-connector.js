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

const assert = require('../utils/assert');
const setObject = require('../utils/set-object');
const Connector = require('./connector');

const fse = require('fs-extra');
const path = require('path');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 */
class SheetsConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);

    this.sheetId = config.resultsPath;
    this.keyFilename = "tmp/gcp-service-account.json";
    this.tests = null;
    this.results = null;

    assert(this.sheetId, 'Unable to locate "SHEET_ID" in envVars');
    //assert(envVars.TESTS_SHEET, 'Unable to locate "TESTS_SHEET" in envVars');
    //assert(envVars.RESULTS_SHEET, 'Unable to locate "RESULTS_SHEET" in envVars');

    //this.testsSheet = this.doc.sheetsByTitle(envVars.TESTS_SHEET);
    //this.resultsSheet = this.doc.sheetsByTitle(envVars.RESULTS_SHEET);
  }

  async authorize(callback) {
    console.log('authorize');

    const auth = await new google.auth.GoogleAuth({
      keyFile: path.resolve(this.keyFilename),
      scopes: SCOPES,
      projectId: "google.com/auto-web-perf"
    });

    const sheets = google.sheets({version: 'v4', auth: auth});

    await sheets.spreadsheets.values.get({
        spreadsheetId: this.sheetId,
        range:'Sheet1!A:C'
    }, (err, res) => {
      console.log('results', err, res);
      if (err) return console.log('The API returned an error: ' + err);
      const rows = res.data.values;
      if (rows.length) {
        console.log('Data');
        // Print columns A and E, which correspond to indices 0 and 4.
        rows.map((row) => {
          console.log(`${row[0]}, ${row[4]}`);
        });
      } else {
        console.log('No data found.');
      }
    });

    if(callback)
      callback(results);
  }

  /**
   * Get the Test list.
   * @return {Array<Object>} Array of Test objects.
   */
  getTests() {
    console.log('getTests', this.tests);

    if (this.tests) return this.tests;
    assert(this.testsPath, 'testsPath is not defined.');

    // TODO: read tests from Sheets
    assert(tests && tests.length > 0, `No tests found in ${this.testsPath}.`);
    return tests;
  }

  /**
   * Get the Result list.
   * @return {Array<Object>} Array of Result objects.
   */
  getResults() {
    console.log('getResults', this.results);

    if (this.results) return this.results;
    assert(this.resultsPath, 'resultsPath is not defined.');

    // TODO: read results from Sheets

    return this.results || [];
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

    // TODO: write back to Sheets.

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
    console.log('appendResultList');

    if(!this.results)
      this.authorize();

    options = options || {};
    let results = options.overrideResults ? [] : this.getResultList();

    if (this.debug) {
      console.log(`Appending ${newResults.length} results to the existing ` +
          `file at ${this.resultsPath}`);
    }
    // TODO: write back to Sheets.

    // Reset the results json cache.
    this.results = null;
  }

  /**
   * Override results to the existing result list.
   * @param {Array<Object>} newResults Array of new Result objects.
   * @param {Object} options
   */
  updateResultList(newResults, options) {
    console.log('updateResultList');

    if(!this.results)
      this.authorize();

    let results = this.getResultList();
    let idToResults = {};

    newResults.forEach(result => {
      idToResults[result.id] = result;
    });

    results = results.map(result => {
      return idToResults[result.id] || result;
    });

    // TODO: write back to Sheets.

    // Reset the results json cache.
    this.results = null;
  }
}

module.exports = SheetsConnector;