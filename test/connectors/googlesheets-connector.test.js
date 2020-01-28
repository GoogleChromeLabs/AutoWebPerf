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
        return {
          getDataRange: () => {},
        }
      },
    };
  },
};

let connector = new GoogleSheetsConnector({
  configTabName: 'config',
  testsTabName: 'tests',
  resultsTabName: 'results',
});

let fakeConfigSheetData = [
  ['Name', 'key', 'value', ''],
  ['WPT API Key', 'apiKeys.webpagetest', 'TEST_APIKEY'],
  ['PSI API Key', 'apiKeys.psi', 'TEST_APIKEY'],
];

let fakeTestsSheetData = [
  [],
  [],
  ['selected', 'url', 'label', 'recurring.frequency', 'webpagetest.settings.connection'],
  [true, 'google.com', 'Google', 'daily', '4G'],
  [false, 'examples.com', 'Example', null, '3G'],
  [true, 'web.dev', 'Web.Dev', 'daily', '3G'],
];

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

let fakeResultsSheetData = [
  [],
  [],
  ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metrics.FCP'],
  [true, 'id-1234', 'single', 'retrieved', 'google.com', 500],
  [false, 'id-5678', 'recurring', 'retrieved', 'web.dev', 800],
]

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
    connector.tabConfigs['configTab'].sheet.getDataRange = function() {
      return {
        getValues: function() {
          return fakeConfigSheetData;
        }
      }
    };
  });

  it('returns list of config values from the Config sheet', async () => {
    let config = connector.getConfig();
    expect(config).toEqual({
      apiKeys: {
        webpagetest: 'TEST_APIKEY',
        psi: 'TEST_APIKEY',
      }
    });
  });
});

describe('GoogleSheetsConnector Tests tab', () => {
  beforeEach(() => {
    // Overrides properties for testing.
    connector.tabConfigs['testsTab'].sheet.getDataRange = function() {
      return {
        getValues: function() {
          return fakeTestsSheetData;
        }
      }
    };
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

  it('sets a new set of tests to the Tests sheet', async () => {
    // TODO
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
    // Overrides properties for testing.
    connector.tabConfigs['resultsTab'].sheet.getDataRange = function() {
      return {
        getValues: function() {
          return fakeResultsSheetData;
        }
      }
    };
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
    // TODO
  });

  it('updates results to the Results sheet', async () => {
    // TODO
  });
});
