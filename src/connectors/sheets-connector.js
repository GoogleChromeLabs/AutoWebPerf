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
const jsonexport = require('jsonexport');
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
    let tests = await this.readSheetData(await this.getTestsSheet());
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
    console.log('updateTestList');

    // TODO: write back to Sheets.

    // Reset the tests cache.
    this.tests = null;    
  }

  async readSheetData(sheet) {
    let rows = await sheet.getRows();
    let headers = sheet.headerValues;
    let output = [];
    let index = 0;
    rows.forEach(row => {
      let obj = {
        sheets: {
          index: index++,
        }
      };
      headers.forEach(header => {
        obj[header] = row[header];
      });
      output.push(obj);
    });
    return output;
  }

  async writeSheetData(sheet, results) {
    var rowsToAdd = [];
    results.forEach(result => {
      rowsToAdd.push(this.readInObject(result));
    });

    let headerArray = new Array();

    rowsToAdd.forEach(result => {
      for (let object in result) {
        if(headerArray.find(obj => obj == String(object) )==undefined) {
          headerArray.push(String(object));
        } 
      }
    });

    await sheet.setHeaderRow(headerArray);
    await sheet.addRows(rowsToAdd);
    await sheet.saveUpdatedCells();
  }

  readInObject(object, _parentProperty, previousResult) {
    let parentProperty = _parentProperty!=undefined ? (_parentProperty + ".") : "";
    let result = previousResult ? previousResult : {};
    for(let subObject in object) {
      if(typeof object[subObject]=='object') {
        this.readInObject(object[subObject], subObject, result);
      } else {
        var objToAdd = {};
        result[parentProperty+subObject] = object[subObject];
      }
    }
    return result;
  }

  /**
   * Get all results.
   * @param  {Object} options
   * @return {Array<Object>} Array of Result objects.
   */
  async getResults(options) {
    if (this.results) return this.results;
    assert(this.resultsPath, 'resultsPath is not defined.');

    let results = await this.readSheetData(await this.getResultsSheet());
    if (this.debug) {
      console.log(`SheetsAPI: Got tests from sheet "${this.resultsSheetName}":`);
      console.log(results);
    }
    return results;
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
  async appendResultList(newResults, options) {
    //console.log('appendResultList');

    options = options || {};
    let idToResults = {};
    let results = options.overrideResults ? [] : await this.getResultList();

    if (this.debug) {
      console.log(`Appending ${newResults.length} results to the existing ` +
          `file at ${this.resultsPath}`);
    }

    await this.writeSheetData(await this.getResultsSheet(), results.concat(newResults));

    // Reset the results json cache.
    this.results = null;
  }

  /**
   * Override results to the existing result list.
   * @param {Array<Object>} newResults Array of new Result objects.
   * @param {Object} options
   */
  async updateResultList(newResults, options) {
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