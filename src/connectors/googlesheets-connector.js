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
  constructor(config) {
    super();
    assert(config.configTabName, 'configTabName is missing in config.');
    assert(config.testsTabName, 'testsTabName is missing in config.');
    assert(config.resultsTabName, 'resultsTabName is missing in config.');

    this.activeSpreadsheet = SpreadsheetApp.getActive();
    this.configSheet = this.activeSpreadsheet.getSheetByName(config.configTabName);
    this.testsSheet = this.activeSpreadsheet.getSheetByName(config.testsTabName);
    this.resultsSheet = this.activeSpreadsheet.getSheetByName(config.resultsTabName);
    // this.locationsSheet = this.activeSpreadsheet.getSheetByName('Locations');
    // this.compareSheet = this.activeSpreadsheet.getSheetByName('Comparison');
    // this.frequencySheet = this.activeSpreadsheet.getSheetByName('schedule_frequency');
    // this.userApiKeySheet = this.activeSpreadsheet.getSheetByName('User_API_Key');
    // this.documentPropertiesSheet = this.activeSpreadsheet.getSheetByName('Document_Properties');
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
      }
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

  getConfig() {
    let configValues = this.getList('configTab');
    return configValues[0];
  }

  healthCheck() {
    // TODO: validate data type in sheets, e.g. check string type for propertyLookup.
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
      let cellRow = test.googlesheets.rowIndex + tabConfig.skipRows + 1;
      propertyLookup.forEach(lookup => {
        let value = lookup ? eval(`test.${lookup}`) : '';
        values.push(value);
      });
      let range = this.getRowRange('testsTab', cellRow);
      range.setValues([values]);
    });
  }

  getRowRange(tabName, cellRow) {
    let lastColumn = this.tabConfigs[tabName].sheet.getLastColumn();
    return this.tabConfigs[tabName].sheet.getRange(cellRow, 1, 1, lastColumn);
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
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = data[tabConfig.propertyLookup - 1];

    let cellRow = this.getResultList().length + 1 + tabConfig.skipRows;
    newResults.forEach(result => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
              `Results Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`result.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      let range = this.getRowRange('resultsTab', cellRow);
      range.setValues([values]);

      cellRow++;
    });
  }

  updateResultList(newResults) {
    let tabConfig = this.tabConfigs['resultsTab'];
    let data = tabConfig.sheet.getDataRange().getValues();
    let propertyLookup = data[tabConfig.propertyLookup - 1];

    let idToRows = {}, cellRow = tabConfig.skipRows + 1;
    let results = this.getResultList();
    results.forEach(result => {
      idToRows[result.id] = cellRow;
      cellRow++;
    });

    newResults.forEach(result => {
      let values = [];
      propertyLookup.forEach(lookup => {
        if (typeof lookup !== 'string') {
          throw new Error(
              `Results Tab: Property lookup ${lookup} is not a string`);
        }
        try {
          let value = lookup ? eval(`result.${lookup}`) : '';
          values.push(value);
        } catch (error) {
          values.push('');
        }
      });

      let range = this.getRowRange('resultsTab', idToRows[result.id]);
      range.setValues([values]);
    });
  }
}

module.exports = GoogleSheetsConnector;
