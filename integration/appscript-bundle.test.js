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

const fs = require('fs');
const AutoWebPerf = require('../build/appscript-bundle');
const {initFakeSheet, fakeSheetData, SpreadsheetApp, Session, Utilities,
    ScriptApp, Logger, Browser, UrlFetchApp} = require('../test/connectors/appscript-test-utils');
const {Frequency, FrequencyInMinutes} = require('../src/common/frequency');

let awp = null;
let fakeSheets = {};

global.SpreadsheetApp = SpreadsheetApp;
global.SpreadsheetApp.getActive = () => ({
  getSheetByName: (tabName) => {
    if (!fakeSheets[tabName]) {
      throw new Error(`${tabName} not initialized with initFakeSheet yet.`);
    }
    return fakeSheets[tabName];
  },
  getId: () => 'sheet-1234',
});
global.Session = Session;
global.Utilities = Utilities;
global.ScriptApp = ScriptApp;
global.Logger = Logger;
global.Browser = Browser;
global.UrlFetchApp = UrlFetchApp;

describe('AWP bundle for AppScript', () => {
  beforeEach(() => {
    fakeSheets = {
      'EnvVars': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
      'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
      'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
      'Tests-1': initFakeSheet(fakeSheetData.fakeTestsSheetData),
      'Results-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Tests-2': initFakeSheet(fakeSheetData.fakeTestsSheetData),
      'Results-2': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
    };

    let awpConfig = {
      tests: {
        connector: 'appscript',
      },
      results: {
        connector: 'appscript',
      },
      helper: 'appscript',
      extensions: [
        'budgets',
        'appscript',
      ],
      // specific configs below
      appscript: {
        defaultTestsTab: 'Tests-1',
        defaultResultsTab: 'Results-1',
        tabs: [{
          tabName: 'Tests-1',
          tabRole: 'tests',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Results-1',
          tabRole: 'results',
          dataAxis: 'row',
          propertyLookup:2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Tests-2',
          tabRole: 'tests',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'Results-2',
          tabRole: 'results',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipColumns: 0,
          skipRows: 3,
        }, {
          tabName: 'EnvVars',
          tabRole: 'envVars',
          dataAxis: 'column',
          propertyLookup: 2, // Starts at 1
          skipRows: 1,
          skipColumns: 2,
        }, {
          tabName: 'System',
          tabRole: 'system',
          dataAxis: 'column',
          propertyLookup: 2, // Starts at 1
          skipRows: 1,
          skipColumns: 2,
        }, {
          tabName: 'Locations',
          tabRole: 'locations',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
          skipRows: 2,
          skipColumns: 0,
        }],
        // For GA tracking
        gaAccount: 'UA-123456789-1',
        awpVersion: 'awp-dev',
        isSendTrackEvent: false,
      },
      budgets: {
        dataSource: 'webpagetest',
      },
      batchUpdateBuffer: 10,
      verbose: false,
      debug: false,
    };

    awp = new AutoWebPerf(awpConfig);
  });

  it('creates AWP instance', () => {
    expect(awp).not.toBe(null);
  });

  it('initializes AWP for AppScript via connector init()', () => {
    awp.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          'data': {
            'location-1': {
              labelShort: 'Location 1',
              PendingTests: {Total: 10},
              Browsers: 'chrome',
            },
            'location-2': {
              labelShort: 'Location 2',
              PendingTests: {Total: 20},
              Browsers: 'firefox',
            }
          }
        })
      }
    };
    awp.connector.init();

    // Ensure it creates triggers for 'submitRecurringTests' and 'onEditFunc'.
    let systemData = fakeSheets['System'].fakeData;
    expect(systemData[2][2]).toEqual('timeBased-submitRecurringTests');

    // Ensure it updates the last init timestamp.
    expect(systemData[4][2]).not.toBe('');
    expect(systemData[4][2]).toBeGreaterThan(0);
  });

  it('submits selected tests and writes results to specific tabs', async () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running tests and writing to Results-2 tab.
    await awp.run({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-2',
      },
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running tests and writing to Results-1 tab.
    await awp.run({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData[3][3]).toEqual('Submitted');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][3]).toEqual('Submitted');
    expect(resultsData[4][4]).toEqual('web.dev');

    // Ensure it creates Retrieve trigger and records it in System tab.
    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('timeBased-retrievePendingResults');
  });

  it('submits selected tests in batch mode and writes results', async () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running tests and writing to Results-2 tab.
    await awp.run({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-2',
      },
      runByBatch: true, // Run with batch mode for all gatherers.
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running tests and writing to Results-1 tab.
    await awp.run({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData[3][3]).toEqual('Submitted');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][3]).toEqual('Submitted');
    expect(resultsData[4][4]).toEqual('web.dev');

    // Ensure it creates Retrieve trigger and records it in System tab.
    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('timeBased-retrievePendingResults');
  });

  it('submits selected tests and writes results with spreadArrayProperty',
      async () => {
    let testsData = [
      ['', ''],
      ['selected', 'cruxbigquery.origin'],
      ['', 'Origin'],
      [true, 'https://example.com'],
      [true, 'https://web.dev'],
    ];
    let resultsData = [
      ['', '', '', ''],
      ['cruxbigquery.metrics.Date', 'cruxbigquery.metrics.Origin',
          'cruxbigquery.metrics.Device', 'cruxbigquery.metrics.FirstContentfulPaint.p75'],
      ['Date', 'Origin', 'Device', 'FCP p75'],
    ];
    fakeSheets['Tests-1'] = initFakeSheet(testsData);
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    // Running tests and writing to Results-1 tab.
    await awp.run({
      filters: ['selected'],
      runByBatch: true, // Mandatory for Cruxbigquery gatherer.
      gatherer: 'cruxbigquery',
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
        spreadArrayProperty: 'cruxbigquery.metrics',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;

    console.log(resultsData);
    expect(resultsData.length).toEqual(6);
    expect(resultsData[3][1]).toBe('https://example.com');
    expect(resultsData[3][2]).toBe('mobile');
    expect(resultsData[3][3]).toBe(900);
    expect(resultsData[4][1]).toBe('https://web.dev');
    expect(resultsData[4][2]).toBe('mobile');
    expect(resultsData[4][3]).toBe(1000);
    expect(resultsData[5][1]).toBe('https://web.dev');
    expect(resultsData[5][2]).toBe('mobile');
    expect(resultsData[5][3]).toBe(1100);
  });

  it('submits selected tests without values of spreadArrayProperty', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'WPT Connection'],
      [true, 'example.com', 'Example', '4G'],
      [true, 'web.dev', 'Example', '4G'],
    ];
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url'],
      ['', 'ID', 'Type', 'Status', 'URL'],
    ];
    fakeSheets['Tests-1'] = initFakeSheet(testsData);
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    // Running tests and writing to Results-1 tab.
    await awp.run({
      filters: ['selected'],
      runByBatch: true, // Mandatory for CrUXBigQuery gatherer.
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
        spreadArrayProperty: 'something.else',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][4]).toBe('example.com');
    expect(resultsData[4][4]).toBe('web.dev');
  });

  it('submits recurring tests and updates next frequency timestamp in ' +
      'activateOnly mode', async () => {
    // Running recurring tests with activateOnly mode.
    await awp.recurring({
      activateOnly: true,
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    let testsData = fakeSheets['Tests-1'].fakeData;

    // Verify the udpated Tests rows with new next trigger timestamp.
    let nowtime = Date.now();
    expect(testsData[3][4]).toBeGreaterThan(nowtime);
    expect(testsData[4][4]).toBe(null);
    expect(testsData[5][4]).toBeGreaterThan(nowtime);

    // Ensure there's no new rows in Results tab.
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);
  });

  it('submits recurring tests and updates in the correct tabs', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'example.com', 'Example', 'Daily', null, '3G'],
    ];
    let testsData2 = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'correct.com', 'Correct', 'Daily', null, '3G'],
    ];
    fakeSheets['Tests-1'] = initFakeSheet(testsData);
    fakeSheets['Tests-2'] = initFakeSheet(testsData2);

    // Running recurring tests with activateOnly mode.
    await awp.recurring({
      filters: ['appscript.rowIndex===4'],
      activateOnly: true,
      appscript: {
        testsTab: 'Tests-2',
        resultsTab: 'Results-2',
      },
    });

    testsData = fakeSheets['Tests-1'].fakeData;
    testsData2 = fakeSheets['Tests-2'].fakeData;

    // Ensure that there's no change in Tests-1 tab
    let nowtime = Date.now();
    expect(testsData[3][1]).toEqual('example.com');
    expect(testsData[3][2]).toEqual('Example');
    expect(testsData[3][4]).toBe(null);

    // Ensure that the target
    expect(testsData2[3][1]).toEqual('correct.com');
    expect(testsData2[3][2]).toEqual('Correct');
    expect(testsData2[3][4]).toBeGreaterThan(nowtime);
  });

  it('submits recurring tests and creates results rows', async () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'recurring.frequency', 'recurring.nextTriggerTimestamp', 'webpagetest.settings.connection'],
      ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'WPT Connection'],
      [true, 'google.com', 'Google', 'Daily', 1234, '4G'],
      [false, 'examples.com', 'Example', null, null, '3G'],
      [true, 'web.dev', 'Web.Dev', 'Daily', 1234, '3G'],
    ];
    fakeSheets['Tests-1'] = initFakeSheet(testsData);

    // Running tests and writing to Results-2 tab.
    await awp.recurring({
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });
    testsData = fakeSheets['Tests-1'].fakeData;

    // Verify the udpated Tests rows with new next trigger timestamp.
    let nowtime = Date.now();
    expect(testsData[3][4]).toBeGreaterThan(nowtime);
    expect(testsData[4][4]).toBe(null);
    expect(testsData[5][4]).toBeGreaterThan(nowtime);

    // Ensure there are two new rows in Results tab.
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][2]).toEqual('Recurring');
    expect(resultsData[3][4]).toEqual('google.com');
    expect(resultsData[4][2]).toEqual('Recurring');
    expect(resultsData[4][4]).toEqual('web.dev');
  });

  it('retrieve and updates results for selected results', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [true, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 'id-5678', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    awp.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
    };

    await awp.retrieve({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    // Ensure there are no additional rows in the Results tab.
    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][3]).toEqual('Retrieved');
  });

  it('retrieve and updates results for selected results with errors',
      async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'errors'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [true, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', ''],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    awp.connector.apiHandler.fetch = () => {
      return {
        statusCode: 400,
        statusText: 'Some error',
      }
    };

    await awp.retrieve({
      filters: ['selected'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    // Ensure there are no additional rows in the Results tab.
    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(4);
    expect(resultsData[3][3]).toEqual('Error');
    expect(resultsData[3][6]).toEqual(['[webpagetest] Some error']);
  });

  it('retrieve all pending results and deletes Retrieve trigger', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [false, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 'id-5678', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', 'trigger-1'],
      ['Submit Recurring Trigger ID', 'RECURRING_TRIGGER_ID', 'trigger-2'],
      ['User\'s TimeZone', 'LAST_INIT_TIMESTAMP', 'GMT'],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    awp.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
    };

    await awp.retrieve({
      filters: ['status!==""', 'status!=="Retrieved"', 'status!=="Error"'],
      appscript: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[4][3]).toEqual('Retrieved');
    expect(resultsData[4][3]).toEqual('Retrieved');

    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('');
  });
});
