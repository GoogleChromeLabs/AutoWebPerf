/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const fs = require('fs');
const AutoWebPerf = require('../build/bundle-googlesheets');
const {initFakeSheet, fakeSheetData, SpreadsheetApp, Session, Utilities,
    ScriptApp, Logger, Browser} = require('../test/connectors/googlesheets-test-utils');

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

describe('AWP bundle for GoogleSheets', () => {
  beforeEach(() => {
    fakeSheets = {
      'Configs': initFakeSheet(fakeSheetData.fakeConfigSheetData),
      'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
      'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
      'Tests-1': initFakeSheet(fakeSheetData.fakeTestsSheetData),
      'Results-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'LatestResults-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Tests-2': initFakeSheet(fakeSheetData.fakeTestsSheetData),
      'Results-2': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      // 'Tests-PSI': initFakeSheet(fakeSheetData.fakePSITestsSheetData),
      // 'Results-PSI': initFakeSheet(fakeSheetData.fakeEmptyPSIResultsSheetData),
    };

    awp = new AutoWebPerf({
      connector: 'GoogleSheets',
      helper: 'GoogleSheets',
      dataSources: ['webpagetest', 'psi', 'chromeuxreport'],
      extensions: [
        'budgets',
        'googlesheets',
      ],
      // specific configs below
      googlesheets: {
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
          latestResultsTab: 'LatestResults-1',
        }, {
          tabName: 'LatestResults-1',
          tabRole: 'latestResults',
          dataAxis: 'row',
          propertyLookup: 2, // Starts at 1
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
          tabName: 'Configs',
          tabRole: 'config',
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
        validationsMaps: [{
          targetTab: 'Tests-1',
          targetProperty: 'webpagetest.settings.location',
          validationTab: 'Locations',
          validationProperty: 'name',
        }],
        // For GA tracking
        gaAccount: 'UA-123145069-1',
        awpVersion: 'awp-dev',
        isSendTrackEvent: false,
      },
      budgets: {
        dataSource: 'webpagetest',
      },
      gatracker: {},
      batchUpdateBuffer: 10,
      verbose: false,
      debug: false,
    });
  });

  it('creates AWP instance', () => {
    expect(awp).not.toBe(null);
  });

  it('initializes AWP for GoogleSheets via connector init()', () => {
    awp.connector.apiHelper.fetch = () => {
      return JSON.stringify({
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
      });
    };
    awp.connector.init();

    // Ensure it creates triggers for 'submitRecurringTests' and 'onEditFunc'.
    let systemData = fakeSheets['System'].fakeData;
    expect(systemData[2][2]).toEqual('timeBased-submitRecurringTests');
    expect(systemData[3][2]).toEqual('forSpreadsheet-onEditFunc');

    // Ensure it updates the last init timestamp.
    expect(systemData[4][2]).not.toBe('');
    expect(systemData[4][2]).toBeGreaterThan(0);
  });

  it('submits selected tests and writes results to specific tabs', () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running tests and writing to Results-2 tab.
    awp.run({
      filters: ['selected'],
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-2',
      },
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running tests and writing to Results-1 tab.
    awp.run({
      filters: ['selected'],
      googlesheets: {
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
    expect(systemData[1][2]).toEqual('timeBased-retrieveResults');
  });

  it('submits selected tests in batch mode and writes results', () => {
    let resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running tests and writing to Results-2 tab.
    awp.run({
      filters: ['selected'],
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-2',
      },
      runByBatch: true, // Run with batch mode for all gatherers.
    });

    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData.length).toEqual(3);

    // Running tests and writing to Results-1 tab.
    awp.run({
      filters: ['selected'],
      googlesheets: {
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
    expect(systemData[1][2]).toEqual('timeBased-retrieveResults');
  });

  it('submits selected tests and writes results with spreadArrayProperty',
      () => {
    let testsData = [
      ['', '', '', '', '', ''],
      ['selected', 'url', 'label', 'chromeuxreport.settings.locale'],
      ['', 'URL', 'Label', 'Frequency', 'CrUX Locale'],
      [true, 'example.com', 'Example', 'US'],
      [true, 'web.dev', 'Example', 'US'],
    ];
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'chromeuxreport.metrics.FirstContentfulPaint.p75'],
      ['', 'ID', 'Type', 'Status', 'URL', 'CrUX FirstContentfulPaint p75'],
    ];
    fakeSheets['Tests-1'] = initFakeSheet(testsData);
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    // Running tests and writing to Results-1 tab.
    awp.run({
      filters: ['selected'],
      runByBatch: true, // Mandatory for ChromeUXReport gatherer.
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
        spreadArrayProperty: 'chromeuxreport.metrics',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(7);
    expect(resultsData[3][4]).toBe('example.com');
    expect(resultsData[3][5]).toBe(100);
    expect(resultsData[4][4]).toBe('example.com');
    expect(resultsData[4][5]).toBe(90);
    expect(resultsData[5][4]).toBe('web.dev');
    expect(resultsData[5][5]).toBe(80);
    expect(resultsData[6][4]).toBe('web.dev');
    expect(resultsData[6][5]).toBe(70);
  });

  it('submits selected tests without values of spreadArrayProperty', () => {
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
    awp.run({
      filters: ['selected'],
      runByBatch: true, // Mandatory for ChromeUXReport gatherer.
      googlesheets: {
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
      'activateOnly mode', () => {
    // Running recurring tests with activateOnly mode.
    awp.recurring({
      activateOnly: true,
      googlesheets: {
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

  it('submits recurring tests and updates in the correct tabs', () => {
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
    awp.recurring({
      filters: ['googlesheets.rowIndex===4'],
      activateOnly: true,
      googlesheets: {
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

  it('submits recurring tests and creates results rows', () => {
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
    awp.recurring({
      googlesheets: {
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

  it('retrieve and updates results for selected results', () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [true, 'id-1234', 'single', 'Submitted', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 'id-5678', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    awp.connector.apiHelper.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };

    awp.retrieve({
      filters: ['selected'],
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    // Ensure there are no additional rows in the Results tab.
    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[3][3]).toEqual('Retrieved');
  });

  it('retrieve all pending results and deletes Retrieve trigger', () => {
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
      ['onEdit trigger ID', 'ONEDIT_TRIGGER_ID', 'trigger-3'],
      ['User\'s TimeZone', 'LAST_INIT_TIMESTAMP', 'trigger-4'],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    awp.connector.apiHelper.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };

    awp.retrieve({
      filters: ['status!==""', 'status!=="Retrieved"', 'status!=="Error"'],
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    expect(resultsData.length).toEqual(5);
    expect(resultsData[4][3]).toEqual('Retrieved');

    systemData = fakeSheets['System'].fakeData;
    expect(systemData[1][2]).toEqual('');
  });

  it('retrieve all pending results and updates Latest Results tab', () => {
    let resultsData = [
      ['', '', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'label', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'Label', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [false, 'id-1234', 'single', 'Submitted', 'label-1', 'google.com', 'id-1234', 500],
      [false, 'id-5678', 'recurring', 'Submitted', 'label-1', 'google.com', 'id-5678', 800],
      [false, 'id-6666', 'single', 'Submitted', 'label-2', 'web.dev', 'id-6666', 500],
      [false, 'id-7777', 'recurring', 'Submitted', 'label-2', 'web.dev', 'id-7777', 800],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let lastestResultsData = [
      ['', '', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'label', 'url', 'webpagetest.metadata.id', 'webpagetest.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'Label', 'URL', 'WPT ID', 'WPT SpeedIndex'],
      [false, 'id-1234', 'single', 'Submitted', 'google.com', 'google.com', 'id-1234', 500],
    ];
    fakeSheets['LatestResults-1'] = initFakeSheet(lastestResultsData);

    awp.connector.apiHelper.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };

    awp.retrieve({
      filters: ['status!==""', 'status!=="Retrieved"', 'status!=="Error"'],
      googlesheets: {
        testsTab: 'Tests-1',
        resultsTab: 'Results-1',
      },
    });

    resultsData = fakeSheets['Results-1'].fakeData;
    lastestResultsData = fakeSheets['LatestResults-1'].fakeData;
    expect(lastestResultsData[3]).toEqual(resultsData[4]);
    expect(lastestResultsData[4]).toEqual(resultsData[6]);
  });
});
