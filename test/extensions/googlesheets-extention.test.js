/**
 * @license Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const GoogleSheetsExtension = require('../../src/extensions/googlesheets-extension');
const setObject = require('../../src/utils/set-object');

global.Session = {
  getActiveUser: () => {
    return {
      getEmail: () => {return 'test@gmail.com';},
    };
  }
};
global.Utilities = {
  computeDigest: () => {return [];},
  DigestAlgorithm: {},
  Charset: {},
};
global.SpreadsheetApp = {
  getActive: () => {return {
    getId: () => {return '1234';},
  }},
};

/* eslint-env jest */
let test, result;
let extension = new GoogleSheetsExtension({
  connector: {
    getList: () => {return []},
  },
  apiHandler: {},
  dataSource: 'webpagetest',
  gaAccount: '12345',
});

extension.apiHandler = {
  fetch: jest.fn(),
};

describe('GoogleSheetsExtension unit tests', () => {
  beforeEach(() => {
    test = {
      url: 'google.com',
      webpagetest: {},
      budgets: {
        dataSource: 'webpagetest',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
        },
      },
    };
    result = {
      url: 'google.com',
      modifiedTimestamp:
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
        },
        metrics: {
          FirstContentfulPaint: {
            metricValue: 1500,
          },
        },
      }
    };
  });

  it('adds createdDate and modifiedDate based on user\'s timezone', async () => {
    extension.afterRun({
      test: test,
      result: result,
    });
  });

  it('computes custom values required for Google Analytics', async () => {
    let customValues = extension.getCustomValues('SubmitManualTest', result);

    expect(customValues).toEqual({
      'cd1': 'SubmitManualTest',
      'cd2': true,
      'cd3': null,
      'cd4': null,
      'cd5': null,
      'cd6': null,
      'cd7': null,
      'cd8': null,
      'cd9': null,
      'cd10': null,
      'cm1': null,
      'cm10': null,
      'cm11': null,
      'cm12': null,
      'cm13': null,
      'cm14': null,
      'cm15': null,
      'cm16': 1000,
      'cm2': 3000,
      'cm3': null,
      'cm4': null,
      'cm5': null,
      'cm6': null,
      'cm7': null,
      'cm8': null,
      'cm9': null,
    });
  });
});
