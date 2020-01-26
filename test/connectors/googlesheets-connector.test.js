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

let fakeTestsSheetData = [
  [],
  [],
  ['selected', 'url', 'label', 'recurring.frequency', 'webpagetest.settings.connection'],
  [true, 'google.com', 'Google', 'daily', '4G'],
  [false, 'examples.com', 'Example', null, '3G'],
  [true, 'web.dev', 'Web.Dev', 'daily', '3G'],
];

/* eslint-env jest */

describe('GoogleSheetsConnector test', () => {
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

  it('returns list of tests from the Tests sheet', async () => {
    let tests = connector.getTestList();
    expect(tests).toEqual([
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
          dataRow: 0,
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
          dataRow: 2,
        }
      },
    ]);
  });

  it('sets a new set of tests to the Tests sheet', async () => {
    let tests = connector.getTestList();
    let newTests = tests;

    setObject(newTests[0], 'webpagetest.metadata.lastTestId', 'testid123');
    setObject(newTests[1], 'webpagetest.metadata.lastTestId', 'testid456');

    connector.getRowRange = (tabName, cellRow) => {
      return {
        setValues: (values) => {
          console.log(values);
          fakeTestsSheetData[
              cellRow - connector.tabConfigs[tabName].dataStartRow] = values;
        }
      }
    };

    connector.updateTestList(newTests);

    expect(tests).toEqual([
      {
        selected: true,
        url: 'google.com',
        label: 'Google',
        recurring: {
          frequency: 'daily',
        },
        webpagetest: {
          metadata: {
            lastTestId: 'testid123',
          },
          settings: {
            connection: '4G',
          }
        },
        googlesheets: {
          dataRow: 0,
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
          metadata: {
            lastTestId: 'testid456',
          },
          settings: {
            connection: '3G',
          }
        },
        googlesheets: {
          dataRow: 2,
        }
      },
    ]);
  });
});
