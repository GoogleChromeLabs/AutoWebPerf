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

const AppScriptExtension = require('../../src/extensions/appscript-extension');
const setObject = require('../../src/utils/set-object');
const patternFilter = require('../../src/utils/pattern-filter');
const Status = require('../../src/common/status');
const {SystemVars} = require('../../src/helpers/appscript-helper');
const {SpreadsheetApp, Session, Utilities} = require('../connectors/appscript-test-utils');

const RETRIEVE_PENDING_RESULTS_FUNC = 'retrievePendingResults';

global.Session = Session;
global.Utilities = Utilities;
global.SpreadsheetApp = SpreadsheetApp;

/* eslint-env jest */
let test, result;
let systemVars = {};
let connector = {
  tabConfigs: {
    'Results-1': {
      tabName: 'Results-1',
      tabRole: 'results',
      latestResultsTab: 'LatestResults-1',
    },
    'LatestResults-1': {
      tabName: 'LatestResults-1',
      tabRole: 'latestResults',
    },
  },
  getList: (tabId) => {return dataByTabId[tabId];},
  getResultList: (options) => {
    let results = dataByTabId[options.appscript.resultsTab];
    return patternFilter(results, options.filters);
  },
  updateList: jest.fn(),
  getSystemVar: (key) => {return systemVars[key];},
  setSystemVar: (key, value) => {systemVars[key] = value;},
};
let extension = new AppScriptExtension({
  connector: connector,
  apiHandler: {},
  dataSource: 'webpagetest',
  gaAccount: '12345',
});
let dataByTabId = {
  'Results-1': [],
  'LatestResults-1': [],
};
let AppScriptHelper = extension.getAppScriptHelper();
AppScriptHelper.createTimeBasedTrigger = () => {return 'trigger-1';};
AppScriptHelper.deleteTriggerByFunction = jest.fn();

extension.apiHandler = {
  fetch: jest.fn(),
};

connector.getList = (tabId) => {
  switch(tabId) {
    case 'locationsTab':
      return [{
        id: 'location-1',
        name: 'Location 1',
      }, {
        id: 'location-2',
        name: 'Location 2',
      }];
      break;

    default:
      return [];
      break;
  }
};

describe('AppScriptExtension beforeRun', () => {
  it('converts location name to location id for WebPageTest test', () => {
    let context = {
      test: {
        url: 'web.dev',
        webpagetest: {
          settings: {
            location: 'Location 1',
          },
        }
      },
    };
    extension.beforeRun(context, {appscript: {resultsTab: 'Results-1'}});
    expect(context.test.webpagetest.settings.locationId).toEqual('location-1');
  });

  it('doesn\'t convert location name for non-WebPageTest test', () => {
    let context = {
      test: {
        url: 'web.dev',
        psi: {
          settings: {
            locale: 'Location 1',
          },
        }
      },
    };
    extension.beforeRun(context, {appscript: {resultsTab: 'Results-1'}});
    expect(context.test.webpagetest).toEqual(undefined);
  });
});

describe('AppScriptExtension afterRun', () => {
  it('sets default values for specific properties if no values assigned', () => {
    let context = {
      test: {
        url: 'web.dev',
        webpagetest: {
          settings: {},
        }
      },
      result: {
        id: 'id-1234',
        label: '1234',
        url: 'web.dev',
        status: Status.SUBMITTED,
      },
    };
    extension.afterRun(context, {appscript: {resultsTab: 'Results-1'}});
    expect(context.result.selected).toEqual(false);
  });
});

describe('AppScriptExtension afterAllRuns', () => {
  beforeEach(() => {
    connector.updateList = jest.fn();
  });

  it('creates the trigger for retrieving results when there are pending results',
      () => {
    let context = {
      results: [{
        id: 'id-1234',
        label: '1234',
        status: Status.SUBMITTED,
      }],
    };

    AppScriptHelper.createTimeBasedTrigger = () => {return 'trigger-1';};
    extension.afterAllRuns(context, {appscript: {resultsTab: 'Results-1'}});
    expect(systemVars[SystemVars.RETRIEVE_TRIGGER_ID]).toEqual('trigger-1');
  });

  it('does not create the trigger when there are no pending results',
      () => {
    let context = {
      results: [{
        id: 'id-1234',
        label: '1234',
        status: 'retrieved',
      }],
    };

    AppScriptHelper.createTimeBasedTrigger = jest.fn();
    extension.afterAllRuns(context, {appscript: {resultsTab: 'Results-1'}});
    expect(AppScriptHelper.createTimeBasedTrigger).not.toHaveBeenCalled();
  });

});

describe('AppScriptExtension afterAllRetrieves', () => {
  beforeEach(() => {
    connector.updateList = jest.fn();
  });

  it('deletes the trigger for retrieving results if no pending results left',
      () => {
    let fakeResults = [{
      id: 'id-1234',
      label: '1234',
      status: Status.RETRIEVED,
    }, {
      id: 'id-1234',
      label: '1234',
      status: Status.SUBMITTED,
    }];
    dataByTabId = {
      'Results-1': fakeResults,
      'LatestResults-1': [],
    };
    extension.afterAllRetrieves({results: fakeResults}, {appscript: {resultsTab: 'Results-1'}});
    expect(AppScriptHelper.deleteTriggerByFunction).not.toHaveBeenCalled();

    fakeResults = [{
      id: 'id-1234',
      label: '1234',
      status: Status.RETRIEVED,
    }, {
      id: 'id-1234',
      label: '1234',
      status: Status.RETRIEVED,
    }];
    dataByTabId = {
      'Results-1': fakeResults,
      'LatestResults-1': [],
    };
    extension.afterAllRetrieves({results: fakeResults}, {appscript: {resultsTab: 'Results-1'}});
    expect(AppScriptHelper.deleteTriggerByFunction).toHaveBeenCalledWith(
        RETRIEVE_PENDING_RESULTS_FUNC);
  });

  it('computes custom values required for Google Analytics', () => {
    let fakeResult = {
      url: 'google.com',
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

    let customValues = extension.getCustomValues('SubmitManualTest', fakeResult);

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
