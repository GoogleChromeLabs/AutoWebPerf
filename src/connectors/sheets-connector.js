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
const flattenObject = require('../../src/utils/flatten-object');
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
      this.resultsSheet = await this.resultsDoc.addSheet({title: this.resultsSheetName});
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

  async updateHeaders(sheet, newObjs) {
    try {
      await sheet.loadHeaderRow();
    } catch (e) {
      if (!e.message || !e.message.includes('No values in the header row')) {
        throw e;
      }
    }
    let headers = sheet.headerValues || [];
    let headerSet = new Set();
    newObjs.forEach(newObj => {
      Object.keys(newObj).forEach(key => {
        if (key !== 'sheets.index') headerSet.add(key);
      });
    });

    headers.forEach(header => {
      headerSet.delete(header);
    });

    let newHeaders = headers.concat([...headerSet]);
    await sheet.resize({
      rowCount: sheet.rowCount,
      columnCount: newHeaders.length,
    });

    if (this.debug) {
      console.log('Updating sheet headers:');
      console.log(newHeaders);
    }

    await sheet.setHeaderRow(newHeaders);
  }

  async updateSheetData(sheet, newObjs) {
    newObjs = this.stringifyRows(newObjs);    
    await this.updateHeaders(sheet, newObjs);
    const rows = await sheet.getRows();

    if (this.debug) {
      console.log('Updating to sheet:');
      console.log(newObjs);
    }

    for (const newObj of newObjs) {
      let rowIndex = newObj['sheets.index'];
      delete newObj['sheets.index'];

      if (typeof(rowIndex) === 'undefined') {
        console.error('Unable to locate a specific row to Sheets.');
        console.log(newObj);
        throw new Error('Unable to locate a specific row to Sheets.');
      }

      let row = rows[rowIndex];
      for (const [key, value] of Object.entries(newObj)) {
        if (Array.isArray(value)) {
          row[key] = value.join(',');
        } else {
          row[key] = value;
        }
      }
      await row.save();
    }
  }

  async readSheetData(sheet) {
    let headers;

    try {
      await sheet.loadHeaderRow()
      headers = sheet.headerValues;

      if (!headers) return [];
    } catch (e) {
      if (this.debug || this.verbose) console.log('SheetsAPI: ' + e.message);
      if (e.message.includes('No values in the header row')) {
        return [];
      }
      throw e;
    }

    let rows = await sheet.getRows();
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

  async writeSheetData(sheet, results, overrideResults) {
    var rowsToAdd = [];
    results.forEach(result => {
      rowsToAdd.push(flattenObject(result));
    });
    rowsToAdd = this.stringifyRows(rowsToAdd);    
    await this.updateHeaders(sheet, rowsToAdd);

    if (this.debug) {
      console.log('rowsToAdd:');
      console.log(rowsToAdd);
    }

    if (this.verbose) {
      console.log(`Adding ${rowsToAdd.length} rows to result sheet.`);
    }

    if (overrideResults) {
      await sheet.clear();
    }

    if (rowsToAdd && rowsToAdd.length > 0) {
      await sheet.resize({
        rowCount: Math.max(rowsToAdd.length + 1, sheet.rowCount),
        columnCount: sheet.columnCount,
      });
      await sheet.addRows(rowsToAdd);
      await sheet.saveUpdatedCells();  
    }
  }

  readInObject(object, _parentProperty, previousResult) {
    let parentProperty = _parentProperty !== undefined ? (_parentProperty + '.') : '';
    let result = previousResult ? previousResult : {};
    for (let subObject in object) {
      if (typeof object[subObject] === 'object') {
        this.readInObject(object[subObject], subObject, result);
      } else {
        result[parentProperty + subObject] = object[subObject];
      }
    }
    return result;
  }

  /**
   * Get all tests.
   * @param  {Object} options
   * @return {Array<Object>} Array of Test objects.
   */
  async getTestList(options) {
    let tests = await this.readSheetData(await this.getTestsSheet());
    tests = this.jsonify(tests);

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
    var rowsToAdd = [];
    newTests.forEach(test => {
      rowsToAdd.push(flattenObject(test));
    });

    await this.updateSheetData(await this.getTestsSheet(), rowsToAdd);
    this.tests = null;    
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
  async getResultList(options) {
    let results;
    try {
      results = await this.getResults();

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
    options = options || {};
    let idToResults = {};

    if (this.debug) {
      console.log(`Appending ${newResults.length} results to the existing ` +
          `file at ${this.resultsPath}`);
    }

    await this.writeSheetData(await this.getResultsSheet(), newResults, 
        options.overrideResults);

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

  jsonify(objs) {
    return objs.map(obj => {
      let newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        setObject(newObj, key, value);
      }
      return newObj;
    });
  }

  stringifyRows(objs) {
    return objs.map(obj => {
      let newObj = {};
      for (const [key, value] of Object.entries(obj)) {
        obj[key] = !['number', 'string'].includes(typeof value) ? JSON.stringify(value) : value;
      }
      return obj;
    });
  }
}

module.exports = SheetsConnector;