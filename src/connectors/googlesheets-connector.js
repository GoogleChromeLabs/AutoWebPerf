'use strict';

const assert = require('../utils/assert');
const patternFilter = require('../utils/pattern-filter');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const transpose = require('../utils/transpose');
const Connector = require('./connector');
const {GoogleSheetsHelper, SystemVars} = require('../helpers/googlesheets-helper');

const DataAxis = {
  ROW: 'row',
  COLUMN: 'column',
};

class GoogleSheetsConnector extends Connector {
  constructor(config, apiHelper) {
    super();
    assert(config.configTabName, 'configTabName is missing in config.');
    assert(config.testsTabName, 'testsTabName is missing in config.');
    assert(config.resultsTabName, 'resultsTabName is missing in config.');
    assert(config.locationsTabName, 'locationsTabName is missing in config.');

    this.apiHelper = apiHelper;
    this.locationApiEndpoint = 'http://www.webpagetest.org/getLocations.php?f=json&k=A';

    this.activeSpreadsheet = SpreadsheetApp.getActive();

    this.tabConfigs = {
      testsTab: {
        tabName: config.testsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.testsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 3, // Starts at 1
        skipColumns: 0,
        skipRows: 3,
      },
      resultsTab: {
        tabName: config.resultsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.resultsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 3, // Starts at 1
        skipColumns: 0,
        skipRows: 3,
      },
      latestResultsTab: {
        tabName: config.latestResultsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.latestResultsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 3, // Starts at 1
        skipColumns: 0,
        skipRows: 3,
      },
      configTab: {
        tabName: config.configTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.configTabName),
        dataAxis: DataAxis.COLUMN,
        propertyLookup: 2, // Starts at 1
        skipRows: 1,
        skipColumns: 2,
      },
      systemTab: {
        tabName: config.systemTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.systemTabName),
        dataAxis: DataAxis.COLUMN,
        propertyLookup: 2, // Starts at 1
        skipRows: 1,
        skipColumns: 2,
      },
      locationsTab: {
        tabName: config.locationsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.locationsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 2, // Starts at 1
        skipRows: 2,
        skipColumns: 0,
      },
    };

    this.validationsMaps = [{
      fromTab: 'testsTab',
      fromProperty: 'webpagetest.settings.location',
      toTab: 'locationsTab',
      toProperty: 'name',
    }];

    this.resultColumnConditions = {
      'webpagetest.metrics.lighthouse.Performance': [0.4, 0.74, 0.75],
      'webpagetest.metrics.lighthouse.PWA': [0.4, 0.74, 0.75],
      'webpagetest.metrics.lighthouse.FCP': [5000, 4000, 2000],
      'webpagetest.metrics.lighthouse.FMP': [5500, 4500, 2500],
      'webpagetest.metrics.lighthouse.FID': [300, 250, 50],
      'webpagetest.metrics.lighthouse.TTI': [8000, 7000, 5000],
      'webpagetest.metrics.FCP': [5000, 4000, 2000],
      'webpagetest.metrics.FMP': [5500, 4500, 2500],
      'webpagetest.metrics.DCL': [7000, 3500, 2000],
      'webpagetest.metrics.TTI': [8000, 7000, 5000],
      'webpagetest.metrics.SpeedIndex': [8000, 4500, 3000],
      'webpagetest.metrics.TTFB': [4000, 2000, 1000],
      'webpagetest.metrics.FirstPaint': [4500, 3000, 1500],
      'webpagetest.metrics.VisualComplete': [8000, 4500, 3000],
      'webpagetest.metrics.onLoad': [10000, 6500, 5000],
      'webpagetest.metrics.Connections': [30, 20, 10],
    };

    this.healthCheck();
  }

  init() {
    // Delete all previous triggers, and create submitting recurring trigger.
    this.initTriggers();

    // Refresh location list.
    this.initLocations();

    // Init all validations.
    this.initValidations();

    // Init condition formatting.
    this.initConditionalFormat();

    // Init user timezone.
    this.initUserTimeZone();

    // Request for WebPageTest API Key.
    this.requestApiKey();

    // Record the last timestamp of init.
    this.setSystemVar(SystemVars.LAST_INIT_TIMESTAMP, Date.now());
  }

  getList(tabId, options) {
    options = options || {};
    let tabConfig = this.tabConfigs[tabId];
    let data = tabConfig.sheet.getDataRange().getValues();

    let skipRows = tabConfig.skipRows || 0;
    let skipColumns = tabConfig.skipColumns || 0;

    if (tabConfig.dataAxis === DataAxis.COLUMN) {
      data = transpose(data);
      skipRows = tabConfig.skipColumns;
      skipColumns = tabConfig.skipRows;
    }

    let propertyLookup = data[tabConfig.propertyLookup - 1];
    data = data.slice(skipRows, data.length);

    let items = [];
    for (let i = 0; i < data.length; i++) {
      let newItem = {};
      for (let j = skipColumns; j < data[i].length; j++) {
        if (propertyLookup[j]) {
          if (typeof propertyLookup[j] !== 'string') {
            throw new Error(
                `${tabId} Tab: Property lookup ${propertyLookup[j]} is not a string`);
          }

          setObject(newItem, propertyLookup[j], data[i][j]);
        }
      }

      // Add metadata for GoogleSheets.
      if (options.appendRowIndex) {
        newItem.googlesheets = {
          rowIndex: i + tabConfig.skipRows + 1,
        };
      }
      items.push(newItem);
    }

    return items;
  }

  getTestList(options) {
    options = options || {};
    options.appendRowIndex = true;

    let tests = this.getList('testsTab', options);
    tests = patternFilter(tests, options.filters);
    return tests;
  }

  updateTestList(newTests, options) {
    this.updateList('testsTab', newTests, (test, rowIndex) => {
      return test.googlesheets.rowIndex;
    } /* rowIndexFunc */);
  }

  getRowRange(tabId, rowIndex) {
    let lastColumn = this.tabConfigs[tabId].sheet.getLastColumn();
    return this.tabConfigs[tabId].sheet.getRange(rowIndex, 1, 1, lastColumn);
  }

  getColumnRange(tabId, propertyKey) {
    let tabConfig = awp.connector.tabConfigs[tabId];
    let sheet = tabConfig.sheet;
    let columnIndex = this.getPropertyIndex(tabId, propertyKey);
    let range = sheet.getRange(tabConfig.skipRows + 1,
        columnIndex, sheet.getLastRow() - tabConfig.skipRows, 1);
    return range;
  }

  getResultList(options) {
    options = options || {};
    options.appendRowIndex = true;

    let results = this.getList('resultsTab', options);

    results = results.filter(result => {
      return result.id;
    });
    results = patternFilter(results, options.filters);

    return results;
  }

  appendResultList(newResults) {
    let tabConfig = this.tabConfigs['resultsTab'];
    let lastRowIndex = this.getResultList().length + 1 + tabConfig.skipRows;
    this.updateList('resultsTab', newResults, (result, rowIndex) => {
      rowIndex = lastRowIndex;
      lastRowIndex++;
      return rowIndex;
    } /* rowIndexFunc */);
  }

  updateResultList(newResults) {
    let tabConfig = this.tabConfigs['resultsTab'];
    let idToRows = {}, rowIndex = tabConfig.skipRows + 1;
    let results = this.getResultList();
    results.forEach(result => {
      idToRows[result.id] = rowIndex;
      rowIndex++;
    });

    this.updateList('resultsTab', newResults, (result, rowIndex) => {
      return idToRows[result.id];
    } /* rowIndexFunc */);
  }

  getPropertyLookup(tabId) {
    let tabConfig = this.tabConfigs[tabId];
    let sheet = tabConfig.sheet;
    let skipRows = tabConfig.skipRows || 0;
    let skipColumns = tabConfig.skipColumns || 0;

    if (tabConfig.dataAxis === DataAxis.ROW) {
      let data = sheet.getRange(
          tabConfig.propertyLookup, skipColumns + 1,
          1, sheet.getLastColumn() - skipColumns - 1).getValues();
      return data[0];

    } else {
      let data = sheet.getRange(
          skipRows + 1, tabConfig.propertyLookup,
          sheet.getLastRow() - skipRows, 1).getValues();
      return data.map(x => x[0]);
    }
  }

  getPropertyIndex(tabId, lookupKey) {
    let propertyLookup = this.getPropertyLookup(tabId);
    for (let i = 0; i < propertyLookup.length; i++) {
      if (propertyLookup[i] === lookupKey) {
        return i + 1;
      }
    }
  }

  initTriggers() {
    GoogleSheetsHelper.deleteAllTriggers();
    Object.keys(SystemVars).forEach(key => {
      this.setSystemVar(key, '');
    });

    // Create recurring trigger.
    let triggerId;
    triggerId = GoogleSheetsHelper.createTimeBasedTrigger(
        'submitRecurringTests', 10 /* minutes */);
    this.setSystemVar(SystemVars.RECURRING_TRIGGER_ID, triggerId);

    // Create onEdit trigger.
    triggerId = GoogleSheetsHelper.createOnEditTrigger('onEditFunc');
    this.setSystemVar(SystemVars.ONEDIT_TRIGGER_ID, triggerId);
  }

  initLocations() {
    // Reset locations tab.
    let locations = this.getList('locationsTab');
    let tabConfig = this.tabConfigs['locationsTab'];
    let sheet = tabConfig.sheet;

    // Get new locations from remote API.
    let res = this.apiHelper.fetch(this.locationApiEndpoint);
    let json = JSON.parse(res);

    let newLocations = [];
    let pendingByLocation = {}
    Object.keys(json.data).forEach(key => {
      let data = json.data[key];
      let newLocation = {
        id: key,
        name: `${data.labelShort} (${key})`,
        pendingTests: data.PendingTests.Total,
        browsers: data.Browsers,
      };
      newLocation.key = key;
      pendingByLocation[newLocation.name] = newLocation.pendingTests;
      newLocations.push(newLocation);
    });

    // Add empty rows if the original location list was longer than the new one.
    for (let i=newLocations.length; i<locations.length; i++) {
      newLocations.push({});
    }
    this.updateList('locationsTab', newLocations);

    // Overrides pending tests to property 'webpagetest.pendingTests'.
    let propertyKey = 'webpagetest.pendingTests';
    let tests = this.getTestList();
    tests.forEach(test => {
      if (!test.webpagetest || !test.webpagetest.settings.location) return;
      test.webpagetest.pendingTests =
          pendingByLocation[test.webpagetest.settings.location];
    });
    this.updateTestList(tests);
  }

  updateList(tabId, items, rowIndexFunc) {
    let tabConfig = this.tabConfigs[tabId];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = data[tabConfig.propertyLookup - 1];

    let rowIndex = tabConfig.skipRows + 1;
    items.forEach(item => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
              `${tabId} Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`item.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      let targetRowIndex = rowIndexFunc ? rowIndexFunc(item, rowIndex) : rowIndex;
      let range = this.getRowRange(tabId, targetRowIndex);
      range.setValues([values]);
      rowIndex++;
    });
  }

  clearList(tabId) {
    let tabConfig = this.tabConfigs[tabId];
    let lastRow = tabConfig.sheet.getLastRow();
    tabConfig.sheet.deleteRows(
        tabConfig.skipRows + 1, lastRow - tabConfig.skipRows);
  }

  initValidations() {
    this.validationsMaps.forEach(mapping => {
      let targetRange = this.getColumnRange(
          mapping.fromTab, mapping.fromProperty);
      let validationRange = this.getColumnRange(
          mapping.toTab, mapping.toProperty);
      let rule = SpreadsheetApp.newDataValidation().requireValueInRange(
          validationRange).build();
      targetRange.setDataValidation(rule);
    });
  }

  initConditionalFormat() {
    let rules = [];
    let tabConfig = this.tabConfigs['resultsTab'];
    let sheet = tabConfig.sheet;
    let propertyLookup = this.getPropertyLookup('resultsTab');

    let columnIndex = 1;
    propertyLookup.forEach(propertyKey => {
      let conditions = this.resultColumnConditions[propertyKey];
      if (conditions && conditions.length > 0) {
        let range = sheet.getRange(tabConfig.skipRows + 1, columnIndex,
            sheet.getMaxRows() - tabConfig.skipRows, 1);
        let maxpoint = conditions[2], midpoint = conditions[1],
            minpoint = conditions[0];
        let maxcolor = '#68bb50', mincolor = '#e06666';
        if (maxpoint < minpoint) {
          maxpoint = conditions[0];
          maxcolor = '#e06666';
          minpoint = conditions[2];
          mincolor = '#68bb50';
        }

        let rule =
            SpreadsheetApp.newConditionalFormatRule()
                .setGradientMaxpointWithValue(
                    maxcolor, SpreadsheetApp.InterpolationType.NUMBER, maxpoint)
                .setGradientMidpointWithValue(
                    '#ffd666', SpreadsheetApp.InterpolationType.NUMBER, midpoint)
                .setGradientMinpointWithValue(
                    mincolor, SpreadsheetApp.InterpolationType.NUMBER, minpoint)
                .setRanges([range])
                .build();
        rules.push(rule);
      }
      columnIndex++;
    });
    sheet.setConditionalFormatRules(rules);
  }

  initUserTimeZone() {
    let userTimeZone = GoogleSheetsHelper.getUserTimeZone();
    this.setSystemVar('USER_TIMEZONE', userTimeZone);
  }

  onEditCell(tabId, propertyKey) {

  }

  /**
   * Request WPT API Key.
   * @param {string} message
   */
  requestApiKey(message) {
    let apiKey = this.getConfigVar('apiKeys.webpagetest');
    message = message || 'Enter your WebPageTest API Key';
    let requestCount = 0;
    while (!apiKey && requestCount < 3) {
      let input = Browser.inputBox(
          message + ' (register at https://www.webpagetest.org/getkey.php)');
      // The input will be 'cancel' if the user uses the close button on top
      if (input !== 'cancel') {
        apiKey = input;
      } else {
        break;
      }
      requestCount++;
    }
    if (apiKey) {
      this.setConfigVar('apiKeys.webpagetest', apiKey);
    } else {
      Browser.msgBox('A WebPageTest API Key is required for this tool to' +
                     ' function. Please enter one on the hidden User_API_Key' +
                     ' tab to continue using this tool.');
    }
  }

  getConfig() {
    let configValues = this.getList('configTab');
    return configValues ? configValues[0] : null;
  }

  getConfigVar(key) {
    return this.getVarFromTab('configTab', key);
  }

  setConfigVar(key, value) {
    this.setVarToTab('configTab', key, value);
  }

  getSystemVar(key) {
    return this.getVarFromTab('systemTab', key);
  }

  setSystemVar(key, value) {
    this.setVarToTab('systemTab', key, value);
  }

  getVarFromTab(tabId, key) {
    let object = (this.getList(tabId) || [])[0];
    try {
      return eval('object.' + key);
    } catch(e) {
      return null;
    }
  }

  setVarToTab(tabId, key, value) {
    let tabConfig = this.tabConfigs[tabId];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = this.getPropertyLookup(tabId);

    let i = 1;
    propertyLookup.forEach(property => {
      if (property === key) {
        let range = tabConfig.sheet.getRange(
            tabConfig.skipRows + i, tabConfig.skipColumns + 1);
        range.setValue(value);
      }
      i++;
    });
  }

  healthCheck() {
    // TODO: validate data type in sheets, e.g. check string type for propertyLookup.
  }
}

module.exports = GoogleSheetsConnector;
