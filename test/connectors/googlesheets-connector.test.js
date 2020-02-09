/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const GoogleSheetsConnector = require('../../src/connectors/googlesheets-connector');
const setObject = require('../../src/utils/set-object');

global.SpreadsheetApp = {
  getActive: () => {
    return {
      getSheetByName: () => {
        return {}
      },
    };
  },
  newDataValidation: () => {
    return {
      requireValueInRange: () => {
        return {
          build: () => {},
        }
      }
    }
  }
};

const initFakeSheet = (tabName, fakeData) => {
  let sheet = connector.tabConfigs[tabName].sheet;
  sheet.fakeData = [...fakeData];
  sheet.getDataRange = () => {
    return {
      getValues: () => {
        return sheet.fakeData;
      }
    }
  };
  sheet.getRange = (row, column, numRows, numColumns) => {
    return {
      getValues: () => {
        let data = sheet.fakeData.slice(row - 1, row + numRows - 1);
        data = data.map(row => {
          return row.slice(column - 1, column + numColumns);
        });
        return data;
      },
      setValue: (value) => {
        sheet.fakeData[row - 1][column - 1] = value;
      },
      setValues: (values) => {
        while(sheet.fakeData.length < row) {
          sheet.fakeData.push([]);
        }
        sheet.fakeData[row - 1] = values[0];
      },
      setDataValidation: () => {},
    }
  };
  sheet.getLastRow = () => {
    return sheet.fakeData.length;
  };
  sheet.getLastColumn = () => {
    return sheet.fakeData[0].length;
  };
  sheet.deleteRows = (row, numRows) => {
    let newFakeData = [];
    for (let i=0; i<sheet.fakeData.length; i++) {
      if (i < row - 1 || i > row + numRows - 1) {
        newFakeData.push(sheet.fakeData[i]);
      }
    }
    sheet.fakeData = newFakeData;
  };
};

let connector = new GoogleSheetsConnector({
  configTabName: 'config',
  testsTabName: 'tests',
  resultsTabName: 'results',
  systemTabName: 'system',
  locationsTabName: 'locations',
}, {} /* apiHelper */);

let fakeConfigSheetData = [
  ['Name', 'key', 'value'],
  ['WPT API Key', 'apiKeys.webpagetest', 'WPT_KEY'],
  ['PSI API Key', 'apiKeys.psi', 'PSI_KEY'],
];

let fakeSystemSheetData = [
  ['Name', 'key', 'value'],
  ['isRecurring', 'isRecurring', true],
  ['triggerId', 'triggerId', '12345'],
];

let fakeTestsSheetData = [
  ['', '', '', '', ''],
  ['', '', '', '', ''],
  ['selected', 'url', 'label', 'recurring.frequency', 'webpagetest.settings.connection'],
  [true, 'google.com', 'Google', 'daily', '4G'],
  [false, 'examples.com', 'Example', null, '3G'],
  [true, 'web.dev', 'Web.Dev', 'daily', '3G'],
];

let fakeResultsSheetData = [
  ['', '', '', '', '', ''],
  ['', '', '', '', '', ''],
  ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metrics.FCP'],
  [true, 'id-1234', 'single', 'retrieved', 'google.com', 500],
  [false, 'id-5678', 'recurring', 'retrieved', 'web.dev', 800],
]

let fakeLocationsSheetData = [
  ['Name', 'ID', 'Pending Tests', 'Browsers'],
  ['name', 'id', 'pendingTests', 'browsers'],
  ['Old location', 'location-old', '0', 'should-be-deleted'],
]

let fakeTests = [
  {
    selected: true,
    url: 'google.com',
    label: 'Google',
    recurring: {
      frequency: 'daily',
    },
    webpagetest: {
      settings: {
        connection: '4G',
      }
    },
    googlesheets: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    url: 'examples.com',
    label: 'Example',
    recurring: {
      frequency: null,
    },
    webpagetest: {
      settings: {
        connection: '3G',
      }
    },
    googlesheets: {
      rowIndex: 5,
    }
  },
  {
    selected: true,
    url: 'web.dev',
    label: 'Web.Dev',
    recurring: {
      frequency: 'daily',
    },
    webpagetest: {
      settings: {
        connection: '3G',
      }
    },
    googlesheets: {
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
    status: 'retrieved',
    webpagetest: {
      metrics: {
        FCP: 500,
      },
    },
    googlesheets: {
      rowIndex: 4,
    }
  },
  {
    selected: false,
    id: 'id-5678',
    type: 'recurring',
    url: 'web.dev',
    status: 'retrieved',
    webpagetest: {
      metrics: {
        FCP: 800,
      },
    },
    googlesheets: {
      rowIndex: 5,
    }
  },
];

/* eslint-env jest */

describe('GoogleSheetsConnector Config tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    initFakeSheet('configTab', fakeConfigSheetData);
  });

  it('returns list of config values from the Config sheet', async () => {
    let config = connector.getConfig();
    expect(config).toEqual({
      apiKeys: {
        webpagetest: 'WPT_KEY',
        psi: 'PSI_KEY',
      }
    });
  });

  it('get a value from Config sheet via getConfigVar', async () => {
    expect(connector.getConfigVar('apiKeys.webpagetest')).toEqual('WPT_KEY');
    expect(connector.getConfigVar('apiKeys.psi')).toEqual('PSI_KEY');
  });

  it('set a value to Config sheet via setConfigVar', async () => {
    connector.setConfigVar('apiKeys.webpagetest', 'TEST');
    expect(connector.getConfigVar('apiKeys.webpagetest')).toEqual('TEST');
    expect(connector.getConfigVar('apiKeys.psi')).toEqual('PSI_KEY');
  });
});

describe('GoogleSheetsConnector Tests tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    initFakeSheet('testsTab', fakeTestsSheetData);
  });

  it('returns all tests from the Tests sheet with filters', async () => {
    let tests = connector.getTestList();
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
      filters: ['googlesheets.rowIndex===6']
    });

    expect(tests).toEqual([
      fakeTests[2],
    ]);
  });
});

describe('GoogleSheetsConnector Results tab', () => {
  beforeEach(() => {
    initFakeSheet('resultsTab', fakeResultsSheetData);
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

  it('appends a new set of results to the Results sheet', async () => {
    let results, expecteResults;
    results = connector.getResultList();

    let newResult = {
      selected: true,
      id: 'id-9999',
      type: 'single',
      url: 'google.com',
      status: 'retrieved',
      webpagetest: {
        metrics: {
          FCP: 500,
        },
      },
      googlesheets: {
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
      id: 'id-1234',
      type: 'single',
      url: 'test.com',
      status: 'retrieved',
      webpagetest: {
        metrics: {
          FCP: 500,
        },
      },
      googlesheets: {
        rowIndex: 4,
      }
    };
    connector.updateResultList([result]);
    expecteResults = connector.getResultList();

    expect(expecteResults.length).toEqual(2);
    expect(expecteResults[0].url).toEqual('test.com');
  });
});

describe('GoogleSheetsConnector System tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    initFakeSheet('systemTab', fakeSystemSheetData);
  });

  it('returns a specific system variable from the System sheet', async () => {
    expect(connector.getSystemVar('isRecurring')).toEqual(true);
    expect(connector.getSystemVar('triggerId')).toEqual('12345');
  });

  it('sets value to a specific system var to the System sheet', async () => {
    connector.setSystemVar('isRecurring', false);
    expect(connector.getSystemVar('isRecurring')).toEqual(false);
    expect(connector.getSystemVar('triggerId')).toEqual('12345');
  });
});

describe('GoogleSheetsConnector Locations tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    initFakeSheet('locationsTab', fakeLocationsSheetData);
  });

  it('updates locations to LocationsTab', async () => {
    connector.apiHelper.fetch = () => {
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

    connector.initLocations();
    let locations = connector.getLocationList();

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

describe('GoogleSheetsConnector getPropertyLookup and getPropertyIndex', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    initFakeSheet('configTab', fakeConfigSheetData);
    initFakeSheet('systemTab', fakeSystemSheetData);
    initFakeSheet('resultsTab', fakeResultsSheetData);
  });

  it('returns property lookup values for sheet with DataAxis.ROW', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('testsTab');
    expect(propertyLookup).toEqual(fakeTestsSheetData[2]);

    propertyLookup = connector.getPropertyLookup('resultsTab');
    expect(propertyLookup).toEqual(fakeResultsSheetData[2]);
  });

  it('returns property lookup values for sheet with DataAxis.COLUMN', async () => {
    let propertyLookup;
    propertyLookup = connector.getPropertyLookup('configTab');
    expect(propertyLookup).toEqual(['apiKeys.webpagetest', 'apiKeys.psi']);

    propertyLookup = connector.getPropertyLookup('systemTab');
    expect(propertyLookup).toEqual(['isRecurring', 'triggerId']);
  });

  it('returns property index with given property key', async () => {
    let index;
    index = connector.getPropertyIndex('configTab', 'apiKeys.webpagetest');
    expect(index).toEqual(1);

    index = connector.getPropertyIndex('resultsTab', 'status');
    expect(index).toEqual(4);
  });
});
