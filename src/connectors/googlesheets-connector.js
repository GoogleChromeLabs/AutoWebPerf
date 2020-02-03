'use strict';

const assert = require('../utils/assert');
const patternFilter = require('../utils/pattern-filter');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const transpose = require('../utils/transpose');
const Connector = require('./connector');

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
    this.configSheet = this.activeSpreadsheet.getSheetByName(config.configTabName);
    this.testsSheet = this.activeSpreadsheet.getSheetByName(config.testsTabName);
    this.resultsSheet = this.activeSpreadsheet.getSheetByName(config.resultsTabName);
    this.systemSheet = this.activeSpreadsheet.getSheetByName(config.systemTabName);
    this.locationsSheet = this.activeSpreadsheet.getSheetByName(config.locationsTabName);
    // this.compareSheet = this.activeSpreadsheet.getSheetByName('Comparison');
    // this.frequencySheet = this.activeSpreadsheet.getSheetByName('schedule_frequency');
    // this.userApiKeySheet = this.activeSpreadsheet.getSheetByName('User_API_Key');
    // this.perfBudgetDashSheet = this.activeSpreadsheet.getSheetByName('Perf Budget Dashboard');

    this.tabConfigs = {
      configTab: {
        tabName: config.configTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.configTabName),
        dataAxis: DataAxis.COLUMN,
        propertyLookup: 2, // Starts at 1
        skipRows: 1,
        skipColumns: 2,
      },
      testsTab: {
        tabName: config.testsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.testsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 3, // Starts at 1
        skipRows: 3,
      },
      resultsTab: {
        tabName: config.resultsTabName,
        sheet: this.activeSpreadsheet.getSheetByName(config.resultsTabName),
        dataAxis: DataAxis.ROW,
        propertyLookup: 3, // Starts at 1
        skipRows: 3,
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

    this.resultColumnConditions = {
      'webpagetest.metrics.lighthouse.Performance': [0.4, 0.74, 0.75],
      'webpagetest.metrics.lighthouse.PWA': [0.4, 0.74, 0.75],
      'webpagetest.metrics.lighthouse.FCP': [5000, 4000, 2000],
      'webpagetest.metrics.lighthouse.FID': [300, 250, 50],
      'webpagetest.metrics.lighthouse.TTI': [8000, 7000, 5000],
      'webpagetest.metrics.FCP': [5000, 4000, 2000],
      'webpagetest.metrics.FMP': [5500, 4500, 2500],
      'webpagetest.metrics.DCL': [7000, 3500, 2000],
      'webpagetest.metrics.TTI': [8000, 7000, 5000],
      'webpagetest.metrics.Speed Index': [8000, 4500, 3000],
      'webpagetest.metrics.TTFB': [4000, 2000, 1000],
      'webpagetest.metrics.Start Render Time': [4500, 3000, 1500],
      'webpagetest.metrics.Visually Complete Time': [8000, 4500, 3000],
      'webpagetest.metrics.TTI (LH)': [8000, 7000, 5000],
      'webpagetest.metrics.TTI (WPT)': [8000, 7000, 5000],
      'webpagetest.metrics.Load Time': [10000, 6500, 5000],
      'webpagetest.metrics.Connection': [30, 20, 10],
    };

    this.healthCheck();
  }

  init() {
    this.updateLocations();
  }

  getList(tabName, options) {
    options = options || {};
    let tabConfig = this.tabConfigs[tabName];
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
                `${tabName} Tab: Property lookup ${propertyLookup[j]} is not a string`);
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
    let tabConfig = this.tabConfigs['testsTab'];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = data[tabConfig.propertyLookup - 1];

    newTests.forEach(test => {
      let values = [];
      let rowIndex = test.googlesheets.rowIndex;
      propertyLookup.forEach(lookup => {
        let value = lookup ? eval(`test.${lookup}`) : '';
        values.push(value);
      });
      let range = this.getRowRange('testsTab', rowIndex);
      range.setValues([values]);
    });
  }

  getRowRange(tabName, rowIndex) {
    let lastColumn = this.tabConfigs[tabName].sheet.getLastColumn();
    return this.tabConfigs[tabName].sheet.getRange(rowIndex, 1, 1, lastColumn);
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

    //
    // newResults.forEach(result => {
    //   let values = [];
    //   propertyLookup.forEach(lookup => {
    //     if (typeof lookup !== 'string') {
    //       throw new Error(
    //           `Results Tab: Property lookup ${lookup} is not a string`);
    //     }
    //     try {
    //       let value = lookup ? eval(`result.${lookup}`) : '';
    //       values.push(value);
    //     } catch (error) {
    //       values.push('');
    //     }
    //   });
    //
    //   let range = this.getRowRange('resultsTab', rowIndex);
    //   range.setValues([values]);
    //
    //   rowIndex++;
    // });
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

  getPropertyLookup(tabName) {
    let tabConfig = this.tabConfigs[tabName];
    let data = tabConfig.sheet.getDataRange().getValues();
    let skipRows = tabConfig.skipRows || 0;
    let skipColumns = tabConfig.skipColumns || 0;

    if (tabConfig.dataAxis === DataAxis.COLUMN) {
      data = transpose(data);
      skipRows = tabConfig.skipColumns;
      skipColumns = tabConfig.skipRows;
    }
    let propertyLookup = data[tabConfig.propertyLookup - 1];
    propertyLookup = propertyLookup.slice(skipColumns, propertyLookup.length);
    return propertyLookup;
  }

  getConfig() {
    let configValues = this.getList('configTab');
    return configValues ? configValues[0] : null;
  }

  updateLocations() {
    // Reset locations tab.
    this.clearList('locationsTab');

    let res = this.apiHelper.fetch(this.locationApiEndpoint);
    let json = JSON.parse(res);

    let locations = [];
    Object.keys(json.data).forEach(key => {
      let data = json.data[key];
      let newLocation = {
        key: key,
        name: `${data.labelShort} (${key})`,
        pendingTests: data.PendingTests.Total,
        browsers: data.Browsers,
      };
      newLocation.key = key;
      locations.push(newLocation);
    });

    this.updateList('locationsTab', locations, (location, rowIndex) => {
      return rowIndex; // No need to modify rowIndex.
    });
  }

  updateList(tabName, items, rowIndexFunc) {
    let tabConfig = this.tabConfigs[tabName];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = data[tabConfig.propertyLookup - 1];

    let rowIndex = tabConfig.skipRows + 1;
    items.forEach(item => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
              `${tabName} Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`item.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      let range = this.getRowRange(tabName, rowIndexFunc(item, rowIndex));
      range.setValues([values]);
      rowIndex++;
    });
  }

  clearList(tabName) {
    let tabConfig = this.tabConfigs[tabName];
    let lastRow = tabConfig.sheet.getLastRow();
    tabConfig.sheet.deleteRows(
        tabConfig.skipRows + 1, lastRow - tabConfig.skipRows);
  }

  getSystemVar(key) {
    let systemVars = (this.getList('systemTab') || [])[0];
    return (systemVars || {})[key];
  }

  setSystemVar(key, value) {
    let tabConfig = this.tabConfigs['systemTab'];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = this.getPropertyLookup('systemTab');

    let i = 1;
    propertyLookup.forEach(propertyKey => {
      if (propertyKey === key) {
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
