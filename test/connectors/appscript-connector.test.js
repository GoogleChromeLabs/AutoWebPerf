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

const AppScriptConnector = require('../../src/connectors/appscript-connector');
const assert = require('../../src/utils/assert');
const setObject = require('../../src/utils/set-object');
const Status = require('../../src/common/status');
const {initFakeSheet, fakeSheetData} = require('./appscript-test-utils');

let fakeSheets = {
  'EnvVars': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
  'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
  'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
  'Tests-1': initFakeSheet(fakeSheetData.fakeTestsSheetData),
  'Results-1': initFakeSheet(fakeSheetData.fakeResultsSheetData),
};

global.SpreadsheetApp = {
  getActive: () => ({
    getSheetByName: (tabName) => {
      if (tabName === 'NonExistingTab') return null;
      return fakeSheets[tabName];
    },
  }),
  newDataValidation: () => ({
    requireValueInRange: () => ({
      build: () => {},
    })
  }),
  newConditionalFormatRule: () => ({
    setGradientMaxpointWithValue: () => ({
      setGradientMidpointWithValue: () => ({
        setGradientMinpointWithValue: () => ({
          setRanges: () => ({
            build: jest.fn(),
          }),
        })
      })
    }),
  }),
  InterpolationType: {
    NUMBER: '',
  },
};

let connectorConfig = {
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
    tabName: 'Tests-2',
    tabRole: 'tests',
    dataAxis: 'row',
    propertyLookup: 2, // Starts at 1
    skipColumns: 0,
    skipRows: 3,
  }, {
    tabName: 'Results-1',
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
  }, {
    tabName: 'NonExistingTab',
    tabRole: 'something',
    dataAxis: 'row',
    propertyLookup: 2, // Starts at 1
    skipRows: 2,
    skipColumns: 0,
  }],
  validationsMaps: [{
    targetTab: 'Tests-1',
    targetProperty: 'webpagetest.settings.location',
    validationTab: 'locationsTab',
    validationProperty: 'name',
  }],
};

let fakeTests = [
  {
    selected: true,
    url: 'google.com',
    label: 'Google',
    recurring: {
      frequency: 'Daily',
      nextTriggerTimestamp: null,
    },
    gatherer: 'webpagetest',
    webpagetest: {
      settings: {
        connection: '4G',
        location: 'TestLocation',
      }
    },
    appscript: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    url: 'examples.com',
    label: 'Example',
    recurring: {
      frequency: null,
      nextTriggerTimestamp: null,
    },
    gatherer: 'webpagetest',
    webpagetest: {
      settings: {
        connection: '3G',
        location: 'TestLocation',
      }
    },
    appscript: {
      rowIndex: 5,
    }
  },
  {
    selected: true,
    url: 'web.dev',
    label: 'Web.Dev',
    recurring: {
      frequency: 'Daily',
      nextTriggerTimestamp: null,
    },
    gatherer: 'webpagetest',
    webpagetest: {
      settings: {
        connection: '3G',
        location: 'TestLocation',
      }
    },
    appscript: {
      rowIndex: 6,
    }
  }
];

let fakeResults = [
  {
    selected: true,
    id: 'id-1234',
    type: 'single',
    url: 'google.com',
    status: Status.RETRIEVED,
    webpagetest: {
      metrics: {
        SpeedIndex: 500,
      },
    },
    appscript: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    id: 'id-5678',
    type: 'recurring',
    url: 'web.dev',
    status: Status.RETRIEVED,
    webpagetest: {
      metrics: {
        SpeedIndex: 800,
      },
    },
    appscript: {
      rowIndex: 5,
    }
  },
];

let connector;

/* eslint-env jest */

describe('AppScriptConnector EnvVars tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['EnvVars'] = initFakeSheet(fakeSheetData.fakeEnvVarsSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns list of envVars values from the EnvVars sheet', async () => {
    let envVars = connector.getEnvVars();
    expect(envVars).toEqual({
      webPageTestApiKey: 'TEST_APIKEY',
      psiApiKey: 'TEST_PSI_KEY',
      gcpProjectId: 'TEST_PROJECTID',
    });
  });

  it('get a value from EnvVars sheet via getEnvVar', async () => {
    expect(connector.getEnvVar('webPageTestApiKey')).toEqual('TEST_APIKEY');
    expect(connector.getEnvVar('psiApiKey')).toEqual('TEST_PSI_KEY');
  });

  it('set a value to EnvVars sheet via setEnvVar', async () => {
    connector.setEnvVar('webPageTestApiKey', 'TEST');
    expect(connector.getEnvVar('webPageTestApiKey')).toEqual('TEST');
    expect(connector.getEnvVar('psiApiKey')).toEqual('TEST_PSI_KEY');
  });
});

describe('AppScriptConnector Tests tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['Tests-1'] = initFakeSheet(fakeSheetData.fakeTestsSheetData);
    fakeSheets['Tests-2'] = initFakeSheet(fakeSheetData.fakeTestsSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns all tests from the Tests sheet', async () => {
    let tests = connector.getTestList();
    expect(tests).toEqual(fakeTests);
  });

  it('returns all tests from a specific sheet', async () => {
    let tests = connector.getTestList({tabId: 'Tests-2'});
    expect(tests).toEqual(fakeTests);
  });

  it('returns a selection of tests from the Tests sheet with filters',
      async () => {

    // Filtering test.selected = true
    let tests = connector.getTestList({
      filters: ['selected'],
    });
    expect(tests).toEqual([
      fakeTests[0],
      fakeTests[2],
    ]);

    // Filtering test.recurring.frequency
    tests = connector.getTestList({
      filters: ['recurring.frequency'],
    });
    expect(tests).toEqual([
      fakeTests[0],
      fakeTests[2],
    ]);

    // Filtering test.selected = true
    tests = connector.getTestList({
      filters: ['webpagetest.settings.connection==="4G"'],
    });
    expect(tests).toEqual([
      fakeTests[0],
    ]);
  });

  it('updates tests to the Tests sheet', async () => {
    let tests = connector.getTestList();
    tests[0].label = 'Updated Label';

    connector.updateTestList(tests);
    let updatedTests = connector.getTestList();

    expect(updatedTests).toEqual(tests);
  });

  it('filters tests based on rowIndex', async () => {
    let tests = connector.getTestList({
      filters: ['appscript.rowIndex===6']
    });

    expect(tests).toEqual([
      fakeTests[2],
    ]);
  });
});

describe('AppScriptConnector Results tab', () => {
  beforeEach(() => {
    fakeSheets['Results-1'] = initFakeSheet(fakeSheetData.fakeResultsSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns list of results from the Results sheet', async () => {
    let results = connector.getResultList();
    expect(results).toEqual(fakeResults);
  });

  it('returns a selection of results from the Results sheet with filters',
      async () => {
    let results, expecteResults;

    results = connector.getResultList({
      filters: ['selected'],
    });
    expect(results).toEqual([
      fakeResults[0],
    ]);
  });

  it('appends a new set of results to an empty Results sheet', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metrics.FirstContentfulPaint'],
      ['', 'ID', 'Type', 'Status', 'URL', 'WPT FirstContentfulPaint'],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let newResult = {
      selected: true,
      id: 'id-9999',
      type: 'single',
      url: 'google.com',
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          SpeedIndex: 500,
        },
      },
    };

    connector.appendResultList([newResult]);
    let expecteResults = connector.getResultList();
    expect(expecteResults.length).toEqual(1);
    expect(expecteResults[0].id).toEqual('id-9999');
    expect(expecteResults[0].url).toEqual('google.com');
  });

  it('appends a new set of results to the Results sheet', async () => {
    let results, expecteResults;
    results = connector.getResultList();

    let newResult = {
      selected: true,
      id: 'id-9999',
      type: 'single',
      url: 'google.com',
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          SpeedIndex: 500,
        },
      },
      appscript: {
        rowIndex: 6,
      }
    };
    connector.appendResultList([newResult]);
    expecteResults = connector.getResultList();
    expect(expecteResults.length).toEqual(3);
    expect(expecteResults).toEqual(results.concat(newResult));
  });

  it('updates results to the Results sheet', async () => {
    let results, expecteResults;
    results = connector.getResultList();
    let result = {
      selected: true,
      id: 'id-5678',
      type: 'recurring',
      url: 'web.dev',
      status: Status.ERROR,
      webpagetest: {
        metrics: {
          SpeedIndex: 800,
        },
      },
      appscript: {
        rowIndex: 5,
      }
    };
    connector.updateResultList([result]);
    expecteResults = connector.getResultList();

    expect(expecteResults.length).toEqual(2);
    expect(expecteResults[1].status).toEqual(Status.ERROR);
    expect(expecteResults[1].url).toEqual('web.dev');
  });

  it('spreads array metrics into multiple rows and maintain other metrics',
      async () => {
    let resultsData = [
      ['', '', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url',
          'cruxbigquery.metrics.SpeedIndex', 'psi.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex', 'PSI SpeedIndex'],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let results = [{
      selected: true,
      id: 'id-5678',
      type: 'recurring',
      url: 'web.dev',
      status: Status.RETRIEVED,
      cruxbigquery: {
        metrics: [{
          SpeedIndex: 500,
        }, {
          SpeedIndex: 600,
        }, {
          SpeedIndex: 700,
        }, {
          SpeedIndex: 800,
        }],
      },
      psi: {
        metrics: {
          SpeedIndex: 999,
        },
      }
    }];

    // Append results and spread cruxbigquery.metrics into multiple rows if it's
    // an array.
    connector.appendResultList(results, {
      appscript: {
        spreadArrayProperty: 'cruxbigquery.metrics',
      },
    });

    let actualResults = connector.getResultList();
    expect(actualResults.length).toEqual(4);

    let duplicateResults = actualResults.filter(result => {
      return result.status === Status.DUPLICATE;
    });
    expect(duplicateResults.length).toEqual(3);

    let metricList = actualResults.map(result => result.cruxbigquery.metrics);
    expect(metricList[0].SpeedIndex).toEqual(500);
    expect(metricList[1].SpeedIndex).toEqual(600);
    expect(metricList[2].SpeedIndex).toEqual(700);
    expect(metricList[3].SpeedIndex).toEqual(800);

    let psiMetricList = actualResults.map(result => result.psi.metrics);
    expect(psiMetricList[0].SpeedIndex).toEqual(999);
    expect(psiMetricList[1].SpeedIndex).toEqual(999);
    expect(psiMetricList[2].SpeedIndex).toEqual(999);
    expect(psiMetricList[3].SpeedIndex).toEqual(999);
  });

  it('spreads array metrics into multiple rows even if no matched key in ' +
      'the target sheet', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'cruxbigquery.metrics.SpeedIndex', 'psi.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex', 'PSI SpeedIndex'],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let results = [{
      selected: true,
      id: 'id-5678',
      type: 'recurring',
      url: 'web.dev',
      status: Status.RETRIEVED,
      cruxbigquery: {
        metrics: [{
          SpeedIndex: 500,
        }, {
          SpeedIndex: 600,
        }, {
          SpeedIndex: 700,
        }, {
          SpeedIndex: 800,
        }],
      },
    }];

    // Append results and spread cruxbigquery.metrics into multiple rows if it's
    // an array.
    connector.appendResultList(results, {
      appscript: {
        spreadArrayProperty: 'cruxbigquery.metrics',
      },
    });

    let actualResults = connector.getResultList();
    expect(actualResults.length).toEqual(4);

    let duplicateResults = actualResults.filter(result => {
      return result.status === Status.DUPLICATE;
    });
    expect(duplicateResults.length).toEqual(3);
  });

  it('spreads array metrics into multiple rows even if no matched ' +
      'spreadArrayProperty key', async () => {
    let resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'psi.metrics.SpeedIndex'],
      ['', 'ID', 'Type', 'Status', 'URL', 'PSI SpeedIndex'],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);

    let results = [{
      selected: true,
      id: 'id-5678',
      type: 'recurring',
      url: 'web.dev',
      status: Status.RETRIEVED,
      psi: {
        metrics: {
          SpeedIndex: 500,
        }
      },
    }];

    // Append results and spread cruxbigquery.metrics into multiple rows if it's
    // an array.
    connector.appendResultList(results, {
      appscript: {
        spreadArrayProperty: 'cruxbigquery.metrics',
      },
    });

    let actualResults = connector.getResultList();
    expect(actualResults.length).toEqual(1);

    let duplicateResults = actualResults.filter(result => {
      return result.status === Status.DUPLICATE;
    });
    expect(duplicateResults.length).toEqual(0);
  });
});

describe('AppScriptConnector System tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['System'] = initFakeSheet(fakeSheetData.fakeSystemSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns a specific system variable from the System sheet', async () => {
    expect(connector.getSystemVar('RETRIEVE_TRIGGER_ID')).toEqual('');
    expect(connector.getSystemVar('RECURRING_TRIGGER_ID')).toEqual('');
  });

  it('sets value to a specific system var to the System sheet', async () => {
    connector.setSystemVar('RETRIEVE_TRIGGER_ID', 'trigger-1');
    expect(connector.getSystemVar('RETRIEVE_TRIGGER_ID')).toEqual('trigger-1');
    expect(connector.getSystemVar('RECURRING_TRIGGER_ID')).toEqual('');
  });
});

describe('AppScriptConnector Locations tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['Locations'] = initFakeSheet(fakeSheetData.fakeLocationsSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('updates locations to LocationsTab', async () => {
    connector.apiHandler.fetch = () => {
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

    connector.initLocations();
    let locations = connector.getList('locationsTab');

    expect(locations).toEqual([
      {
        id: 'location-1',
        name: 'Location 1 (location-1)',
        pendingTests: 10,
        browsers: 'chrome',
      },
      {
        id: 'location-2',
        name: 'Location 2 (location-2)',
        pendingTests: 20,
        browsers: 'firefox',
      },
    ]);
  });
});

describe('AppScriptConnector additional functions', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    fakeSheets['EnvVars'] = initFakeSheet(fakeSheetData.fakeEnvVarsSheetData);
    fakeSheets['System'] = initFakeSheet(fakeSheetData.fakeSystemSheetData);
    fakeSheets['Tests-1'] = initFakeSheet(fakeSheetData.fakeTestsSheetData);
    fakeSheets['Results-1'] = initFakeSheet(fakeSheetData.fakeResultsSheetData);
    connector = new AppScriptConnector(connectorConfig, {} /* apiHandler */);
  });

  it('returns property lookup values for sheet with DataAxis.ROW', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('Tests-1');
    expect(propertyLookup).toEqual(fakeSheetData.fakeTestsSheetData[1]);

    propertyLookup = connector.getPropertyLookup('Results-1');
    expect(propertyLookup).toEqual(fakeSheetData.fakeResultsSheetData[1]);
  });

  it('returns property lookup values for sheet with DataAxis.COLUMN', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('envVarsTab');
    expect(propertyLookup).toEqual([
        'webPageTestApiKey', 'psiApiKey', 'gcpProjectId']);

    propertyLookup = connector.getPropertyLookup('systemTab');
    expect(propertyLookup).toEqual([
        'RETRIEVE_TRIGGER_ID', 'RECURRING_TRIGGER_ID', 'ONEDIT_TRIGGER_ID',
        'LAST_INIT_TIMESTAMP']);
  });

  it('returns property index with given property key', async () => {
    let index;
    index = connector.getPropertyIndex('envVarsTab', 'webPageTestApiKey');
    expect(index).toEqual(1);

    index = connector.getPropertyIndex('Results-1', 'status');
    expect(index).toEqual(4);
  });

  it('returns specific tabIds with given a tab role', async () => {
    let index, tabIds;
    tabIds = connector.getTabIds('tests');
    expect(tabIds).toEqual(['Tests-1', 'Tests-2']);

    tabIds = connector.getTabIds('results');
    expect(tabIds).toEqual(['Results-1']);
  });

  it('returns specific tabIds with given a tab role', async () => {
    let tabId = connector.getTabId('Locations');
    expect(tabId).toEqual('locationsTab');
  });

  it('throws error if not able to find a specific sheet', () => {
    expect(() => {connector.getSheet('NonExistingTab')}).toThrow(Error);
  });

  it('returns the last row with values', () => {
    let resultsData, lastRowIndex;
    resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'cruxbigquery.metrics.SpeedIndex', 'psi.metrics.SpeedIndex'],
      ['Selected', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex', 'PSI SpeedIndex'],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
      ['', '', '', '', '', ''],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);
    lastRowIndex = connector.getTabLastRow('Results-1');
    expect(lastRowIndex).toEqual(3);

    resultsData = [
      ['', '', '', '', '', ''],
      ['selected', 'id', 'type', 'status', 'url', 'cruxbigquery.metrics.SpeedIndex'],
      ['Selected', 'ID', 'Type', 'Status', 'URL', 'CrUX SpeedIndex'],
      ['true', 'id-1234', 'test', 'Retrieved', 'web.dev', '1234'],
      ['true', 'id-5678', 'test', 'Retrieved', 'web.dev', '1234'],
      ['', '', '', '', '', ''],
    ];
    fakeSheets['Results-1'] = initFakeSheet(resultsData);
    lastRowIndex = connector.getTabLastRow('Results-1');
    expect(lastRowIndex).toEqual(5);
  });
});
