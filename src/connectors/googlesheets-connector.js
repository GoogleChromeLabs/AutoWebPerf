'use strict';

const assert = require('../utils/assert');
const setObject = require('../utils/set-object');
const Connector = require('./connector');

class GoogleSheetsConnector extends Connector {
  constructor(config) {
    super();
    assert(config.testsTab, 'testsTab is missing in config.');
    assert(config.resultsTab, 'resultsTab is missing in config.');

    this.activeSpreadsheet = SpreadsheetApp.getActive();
    this.testsSheet = this.activeSpreadsheet.getSheetByName(config.testsTab);
    this.resultsSheet = this.activeSpreadsheet.getSheetByName(config.resultsTab);
    // this.locationsSheet = this.activeSpreadsheet.getSheetByName('Locations');
    // this.compareSheet = this.activeSpreadsheet.getSheetByName('Comparison');
    // this.frequencySheet = this.activeSpreadsheet.getSheetByName('schedule_frequency');
    // this.userApiKeySheet = this.activeSpreadsheet.getSheetByName('User_API_Key');
    // this.documentPropertiesSheet = this.activeSpreadsheet.getSheetByName('Document_Properties');
    // this.perfBudgetDashSheet = this.activeSpreadsheet.getSheetByName('Perf Budget Dashboard');

    this.tabConfigs = {
      testsTab: {
        tabName: config.testsTab,
        columnLookupRow: 2, // Row starts at 1
        dataStartRow: 4,
        sheet: this.activeSpreadsheet.getSheetByName(config.testsTab),
        // dataConversion: {
        //   cellToObject: {
        //
        //   },
        //   objectToCell: {
        //
        //   },
        // },
      },
      resultsTab: {
        tabName: config.resultsTab,
        columnLookupRow: 2, // Row starts at 1
        dataStartRow: 4,
        sheet: this.activeSpreadsheet.getSheetByName(config.resultsTab),
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
  }

  getList(tabName, options) {
    let tabConfig = this.tabConfigs[tabName];

    let data = tabConfig.sheet.getDataRange().getValues();
    let columnLookup = data[tabConfig.columnLookupRow - 1];

    data = data.slice(tabConfig.dataStartRow - 1, data.length);

    let items = [];
    for (let i = 0; i < data.length; i++) {
      let newTest = {};
      for (let j = 0; j < data[i].length; j++) {
        if (columnLookup[j]) {
          setObject(newTest, columnLookup[j], data[i][j]);
        }
      }

      // Add metadata for GoogleSheets.
      newTest.googlesheets = {
        dataRow: i,
      };
      items.push(newTest);
    }

    return items;
  }

  getTestList(options) {
    let selected = (options || {}).selected;
    let tests = this.getList('testsTab', options);

    // Apply selection.
    tests = tests.filter(test => {
      return test.selected;
    });

    return tests;
  }

  updateTestList(newTests, options) {
    let tabConfig = this.tabConfigs['testsTab'];

    let testsData = tabConfig.sheet.getDataRange().getValues();
    let columnLookup = testsData[tabConfig.columnLookupRow - 1];

    newTests.forEach(test => {
      let values = [];
      let cellRow = test.googlesheets.dataRow + tabConfig.dataStartRow;
      columnLookup.forEach(lookup => {
        let value = lookup ? eval(`test.${lookup}`) : '';
        values.push(value);
      });
      let range = this.getRowRange('testsTab', cellRow);
      range.setValues(values);
    });
  }

  getRowRange(tabName, cellRow) {
    return this.tabConfigs[tabName].sheet.getRange(`A${cellRow}:ZZZ${cellRow}`)
  }

  getResultList() {
    let selected = (options || {}).selected;
    let results = this.getList('resultsTab', options);

    // Apply selection.
    results = results.filter(test => {
      return test.selected;
    });

    return results;
  }

  appendResultList(newResults) {
    let results = this.getResultList();
    let filepath = path.resolve(`./output/${this.results}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results.concat(newResults),
      }, null, 2));
  }

  updateResultList(results) {
    let filepath = path.resolve(`./output/${this.results}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results,
      }, null, 2));
  }
}

module.exports = GoogleSheetsConnector;
