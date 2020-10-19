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
const assert = require('../../src/utils/assert');

const fakeSheetData = {
  fakeEnvVarsSheetData: [
    ['Name', 'key', 'value'],
    ['WPT API Key', 'webPageTestApiKey', 'TEST_APIKEY'],
    ['PSI API Key', 'psiApiKey', 'TEST_PSI_KEY'],
    ['GCP Project ID', 'gcpProjectId', 'TEST_PROJECTID'],
  ],
  fakeSystemSheetData: [
    ['Name', 'key', 'value'],
    ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ['Submit Recurring Trigger ID', 'RECURRING_TRIGGER_ID', ''],
    ['onEdit trigger ID', 'ONEDIT_TRIGGER_ID', ''],
    ['User\'s TimeZone', 'LAST_INIT_TIMESTAMP', ''],
  ],
  fakeLocationsSheetData: [
    ['Name', 'ID', 'Pending Tests', 'Browsers'],
    ['name', 'id', 'pendingTests', 'browsers'],
    ['Old location', 'location-old', '0', 'should-be-deleted'],
  ],
  fakeTestsSheetData: [
    ['', '', '', '', '', '', '', ''],
    ['selected', 'url', 'label', 'recurring.frequency',
        'recurring.nextTriggerTimestamp', 'gatherer', 'webpagetest.settings.connection',
        'webpagetest.settings.location'],
    ['', 'URL', 'Label', 'Frequency', 'Next Trigger Timestamp', 'Audit Platforms', 'WPT Connection', 'WPT Location'],
    [true, 'google.com', 'Google', 'Daily', null, 'webpagetest', '4G', 'TestLocation'],
    [false, 'examples.com', 'Example', null, null, 'webpagetest', '3G', 'TestLocation'],
    [true, 'web.dev', 'Web.Dev', 'Daily', null, 'webpagetest', '3G', 'TestLocation'],
  ],
  fakeResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metrics.SpeedIndex'],
    ['', 'ID', 'Type', 'Status', 'URL', 'WPT SpeedIndex'],
    [true, 'id-1234', 'single', 'Retrieved', 'google.com', 500],
    [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 800],
  ],
  fakeEmptyResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'url', 'webpagetest.metrics.SpeedIndex'],
    ['', 'ID', 'Type', 'Status', 'URL', 'WPT SpeedIndex'],
  ],
  fakePSITestsSheetData: [
    ['', '', '', '', ''],
    ['selected', 'url', 'label', 'recurring.frequency', 'gatherer', 'psi.settings.network'],
    ['', 'URL', 'Label', 'Recurring Frequency', 'Audit Platforms', 'PSI network'],
    [true, 'google.com', 'Google', 'Daily', 'psi', '4G'],
    [false, 'examples.com', 'Example', null, 'psi', '3G'],
    [true, 'web.dev', 'Web.Dev', 'Daily', 'psi', '3G'],
  ],
  fakePSIResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'url', 'psi.metrics.FCP'],
    ['', 'ID', 'Type', 'Status', 'URL', 'PSI FCP'],
    [true, 'id-1234', 'single', 'Retrieved', 'google.com', 1000],
    [false, 'id-5678', 'recurring', 'Retrieved', 'web.dev', 1200],
  ],
  fakeEmptyPSIResultsSheetData: [
    ['', '', '', '', '', ''],
    ['selected', 'id', 'type', 'status', 'url', 'psi.metrics.FCP'],
    ['', 'ID', 'Type', 'Status', 'URL', 'PSI FCP'],
  ],
}

const initFakeSheet = (fakeData) => {
  let sheet = {};

  // Backfill rows with non-consistent length of cells.
  let maxColumnLength = Math.max(...fakeData.map(row => row.length));
  fakeData.forEach(row => {
    while (row.length < maxColumnLength) {
      row.push('');
    }
  });
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
        while(sheet.fakeData.length < row - 1) {
          sheet.fakeData.push([]);
        }
        let i = row - 1;
        values.forEach(value => {
          if (i < fakeData.length)
            sheet.fakeData[i] = value;
          else
            sheet.fakeData.push(value);
          i++;
        })
      },
      setDataValidation: () => {},
      getLastRow: () => {
        return sheet.fakeData.length;
      },
    }
  };
  sheet.getMaxRows = () => {
    return sheet.fakeData.length;
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
  sheet.setConditionalFormatRules = jest.fn();
  return sheet;
};

const SpreadsheetApp = {
  getActive: () => ({
    getSheetByName: (tabName) => {
      return {};
    },
    getId: () => 'sheet-1234',
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

const Session = {
  getActiveUser: () => ({
    getEmail: () => 'test@gmail.com',
  })
};

const Utilities = {
  computeDigest: () => {return [];},
  DigestAlgorithm: {},
  Charset: {},
  formatDate: () => '2020-01-01',
};

const ScriptApp = {
  getProjectTriggers: () => {
    return [];
  },
  newTrigger: (functionName) => ({
    timeBased: () => ({
      everyMinutes: () => ({
        create: () => ({
          getUniqueId: () => `timeBased-${functionName}`,
        }),
      })
    }),
    forSpreadsheet: () => ({
      onEdit: () => ({
        create: () => ({
          getUniqueId: () => `forSpreadsheet-${functionName}`,
        }),
      })
    }),
  }),
  deleteTrigger: (trigger) => {},
};

const Logger = {
  log: jest.fn(),
};

const Browser =  {
  msgBox: jest.fn(),
};

const UrlFetchApp = {
  fetch: () => ({
    getResponseCode: jest.fn(),
    getContentText: jest.fn(),
  }),
}

module.exports = {
  initFakeSheet,
  fakeSheetData,
  SpreadsheetApp,
  Session,
  Utilities,
  ScriptApp,
  Logger,
  Browser,
  UrlFetchApp,
};
