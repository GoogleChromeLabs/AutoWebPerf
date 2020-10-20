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
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
// const { GoogleSpreadsheet } = require('google-spreadsheet');


/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 */
class SheetsConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);

    this.apiKey = envVars.SHEETS_APIKEY;
    this.sheetId = envVars.SHEET_ID;

    assert(this.apiKey, 'Unable to locate "SHEETS_APIKEY" in envVars');
    assert(this.sheetId, 'Unable to locate "SHEET_ID" in envVars');
    assert(envVars.TESTS_SHEET, 'Unable to locate "TESTS_SHEET" in envVars');
    assert(envVars.RESULTS_SHEET, 'Unable to locate "RESULTS_SHEET" in envVars');

    this.doc = new GoogleSpreadsheet('this.sheetId');
    doc.useApiKey(this.apiKey);
    await doc.loadInfo(); // loads sheets
    assert(this.doc, 'Unable to connect to GoogleSheets doc: ' + this.sheetId);

    this.testsSheet = this.doc.sheetsByTitle(envVars.TESTS_SHEET);
    this.resultsSheet = this.doc.sheetsByTitle(envVars.RESULTS_SHEET);
  }

  getAuth() {
    // If modifying these scopes, delete token.json.
    const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
    // The file token.json stores the user's access and refresh tokens, and is
    // created automatically when the authorization flow completes for the first
    // time.
    const TOKEN_PATH = 'tmp/auth-token.json';

    // Load client secrets from a local file.
    fs.readFile('credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      authorize(JSON.parse(content), listMajors);
    });

    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    function authorize(credentials, callback) {
      const {client_secret, client_id, redirect_uris} = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
          client_id, client_secret, redirect_uris[0]);

      // Check if we have previously stored a token.
      fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
      });
    }

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback for the authorized client.
     */
    function getNewToken(oAuth2Client, callback) {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
      });
      console.log('Authorize this app by visiting this url:', authUrl);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) return console.error('Error while trying to retrieve access token', err);
          oAuth2Client.setCredentials(token);
          // Store the token to disk for later program executions
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
          });
          callback(oAuth2Client);
        });
      });
    }

    /**
     * Prints the names and majors of students in a sample spreadsheet:
     * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
     * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
     */
    function listMajors(auth) {
      const sheets = google.sheets({version: 'v4', auth});
      sheets.spreadsheets.values.get({
        spreadsheetId: '1Hgx0QLAwxuW-qpHcJMiRw877_4wxIaul2BwkvGCS4R4',
        range: 'Sheet1!A2:E',
      }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const rows = res.data.values;
        if (rows.length) {
          console.log('Name, Major:');
          // Print columns A and E, which correspond to indices 0 and 4.
          rows.map((row) => {
            console.log(`${row[0]}, ${row[4]}`);
          });
        } else {
          console.log('No data found.');
        }
      });
    }

  }

  /**
   * Get the Test list.
   * @return {Array<Object>} Array of Test objects.
   */
  getTests() {
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
    if (this.results) return this.results;
    assert(this.resultsPath, 'resultsPath is not defined.');

    // TODO: read results from Sheets

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
