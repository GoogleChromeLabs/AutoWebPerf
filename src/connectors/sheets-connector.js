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
const { GoogleSpreadsheet } = require('google-spreadsheet');

/**
 * the connector handles read and write actions with GoogleSheets as a data
 * store.
 */
class SheetsConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);
    [this.testsSheetId, this.testsSheetName] = config.testsPath.split('/');
    [this.resultsSheetId, this.resultsSheetName] = config.resultsPath.split('/');
    this.keyFilename = envVars.SERVICE_ACCOUNT_CREDENTIALS;
    this.tests = null;
    this.results = null;
    this.basedir = process.cwd();

    assert(this.keyFilename, 'SERVICE_ACCOUNT_CREDENTIALS is missing in envVars.');

    if (!this.testsSheetName) this.testsSheetName = 'Tests';
    if (!this.resultsSheetName) this.resultsSheetName = 'Results';
  }

  async getSheet(sheetId) {
    const doc = new GoogleSpreadsheet(sheetId);
    await doc.useServiceAccountAuth(require(this.basedir + '/' + this.keyFilename));
    await doc.loadInfo(); // loads document properties and worksheets    
    return doc;
  }

  async getTestsSheet() {
    if (this.testsSheet) return this.testsSheet;

    assert(this.testsSheetId, 'testsSheetId is not defined in config.testsPath.');
    this.testsDoc = await this.getSheet(this.testsSheetId);
    this.testsSheet = this.testsDoc.sheetsByTitle[this.testsSheetName];

    assert(this.testsSheet, `Unable to locate Tests sheet "${this.testsSheetName}"`);
    return this.testsSheet;
  }

  async getResultsSheet() {
    if (this.resultsSheet) return this.resultsSheet;

    assert(this.resultsSheetId, 'resultsSheetId is not defined in config.resultsPath.');
    this.resultsDoc = await this.getSheet(this.resultsSheetId);
    this.resultsSheet = this.resultsDoc.sheetsByTitle[this.resultsSheetName];

    // Create a new sheet if the sheet doesn't exist.
    if (!this.resultsSheet) {
      this.resultsSheet = await doc.addSheet({title: 'this.resultsSheetName'});
    }

    return this.resultsSheet;
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
  async getTestList(options) {
    let sheet = await this.getTestsSheet();
    let rows = await sheet.getRows();
    let headers = sheet.headerValues;
    let tests = [];

    // Manually add index to all test objects.
    let index = 0;
    rows.forEach(row => {
      let test = {
        sheets: {
          index: index++,
        }
      };
      headers.forEach(header => {
        test[header] = row[header];
      });
      tests.push(test);
    });

    if (this.debug) {
      console.log(`SheetsAPI: Got tests from sheet "${this.testsSheetName}":`);
      console.log(tests);
    }

    return tests;
  }

  /**
   * Update tests with the given new test objects.
   * @param {Array<Object>} Array of new Test objects.
   * @param  {Object} options
   */
  async updateTestList(newTests, options) {

    // TODO: write back to Sheets.

    // Reset the tests cache.
    this.tests = null;    
  }

  /**
   * Get all results.
   * @param  {Object} options
   * @return {Array<Object>} Array of Result objects.
   */
  async getResultList(options) {
    let sheet = await this.getResultsSheet();
    let results;
    try {
      // TODO: Get results from Results sheet.

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
  async appendResultList(newResults, options) {
    console.log('appendResultList');

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
  async updateResultList(newResults, options) {
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