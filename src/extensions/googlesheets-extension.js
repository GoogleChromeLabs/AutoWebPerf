'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const {GoogleSheetsHelper, SystemVars} = require('../helpers/googlesheets-helper');

class GoogleSheetsExtension extends Extension {
  constructor(config) {
    super();
    assert(config.connector, 'connector is missing in config.');
    this.connector = config.connector;
    this.userTimeZone = GoogleSheetsHelper.getUserTimeZone();
    this.locations = null;
  }

  /**
   * beforeRun - Convert location name to id based on location tab.
   * @param {object} params
   */
  beforeRun(params) {
    this.locations = this.locations || this.connector.getList('locationsTab');

    let test = params.test;
    this.locations.forEach(location => {
      if (test.webpagetest.settings.location === location.name) {
        test.webpagetest.settings.locationId = location.id;
      }
    });
  }

  /**
   * afterRun - Convert location id to name based on location tab.
   * @param {object} params
   */
  afterRun(params) {
    this.locations = this.locations || this.connector.getList('locationsTab');
    let test = params.test;
    let result = params.result;

    // Replace locationId with location name.
    this.locations.forEach(location => {
      if (test.webpagetest.settings.locationId === location.id) {
        test.webpagetest.settings.location = location.name;
      }
    });

    // Format recurring.nextTrigger with user's timezone.
    if (test.recurring.nextTriggerTimestamp) {
      test.recurring.nextTriggerTime = GoogleSheetsHelper.getFormattedDate(
          new Date(test.recurring.nextTriggerTimestamp), this.userTimeZone);
    } else {
      test.recurring.nextTriggerTime = '';
    }

    // Format createdDate
    if (result && result.createdTimestamp) {
      result.createdDate = GoogleSheetsHelper.getFormattedDate(
          new Date(result.createdTimestamp), this.userTimeZone, 'MM/dd/YYYY');
    }
  }

  beforeAllRun(params) {}

  afterAllRuns(params) {
    // Create trigger for retrieving results.
    let tests = params.tests || [];
    if (tests.length > 0) {
      let triggerId = this.connector.getSystemVar(SystemVars.RETRIEVE_TRIGGER_ID);
      console.log(`${SystemVars.RETRIEVE_TRIGGER_ID} = ${triggerId}`);

      if (!triggerId) {
        console.log('Creating Trigger for retrieveResults...');
        triggerId = GoogleSheetsHelper.createTimeBasedTrigger('retrieveResults', 10 /* minutes */);
        this.connector.setSystemVar(SystemVars.RETRIEVE_TRIGGER_ID, triggerId);
      }
    }
  }

  afterAllRetrieves(params) {
    let results = params.results || [];
    let pendingResults = results.filter(result => {
      return result.status !== Status.RETRIEVED;
    });
    let retrievedResults = results.filter(result => {
      return result.status === Status.RETRIEVED;
    });

    // Collect all latest retrieved results by labels.
    let labels = retrievedResults.map(result => result.label);
    let resultsByLabel = {};

    let latestResults = this.connector.getList('latestResultsTab');
    latestResults.forEach(result => {
      resultsByLabel[result.label] = result;
    });
    retrievedResults.forEach(result => {
      resultsByLabel[result.label] = result;
    });

    let newLatestResults = [];
    Object.keys(resultsByLabel).forEach(label => {
      newLatestResults.push(resultsByLabel[label]);
    });

    this.connector.updateList('latestResultsTab', newLatestResults,
        null /* use default rowIndex */);

    // Delete trigger if all results are retrieved.
    if (pendingResults.length === 0) {
      console.log('Deleting Trigger for retrieveResults...');
      GoogleSheetsHelper.deleteTriggerByFunction('retrieveResults');
      this.connector.setSystemVar(SystemVars.RETRIEVE_TRIGGER_ID, '');
    }
  }
}

module.exports = GoogleSheetsExtension;
