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
    this.locations = this.locations || this.connector.getLocationList();

    let test = params.test;
    this.locations.forEach(location => {
      if (test.webpagetest.settings.locationId === location.name) {
        test.webpagetest.settings.locationId = location.id;
      }
    });
  }

  /**
   * afterRun - Convert location id to name based on location tab.
   * @param {object} params
   */
  afterRun(params) {
    this.locations = this.locations || this.connector.getLocations();
    let test = params.test;

    // Replace locationId with location name.
    this.locations.forEach(location => {
      if (test.webpagetest.settings.locationId === location.id) {
        test.webpagetest.settings.locationId = location.name;
      }
    });

    // Format recurring.nextTrigger with user's timezone.
    if (test.recurring.nextTriggerTimestamp) {
      test.recurring.nextTriggerTime = GoogleSheetsHelper.getFormattedDate(
          new Date(test.recurring.nextTriggerTimestamp), this.userTimeZone);
    } else {
      test.recurring.nextTriggerTime = '';
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

    // Delete trigger if all results are retrieved.
    if (pendingResults.length === 0) {
      let triggerId = this.connector.getSystemVar(SystemVars.RETRIEVE_TRIGGER_ID);
      console.log(`${SystemVars.RETRIEVE_TRIGGER_ID} = ${triggerId}`);

      if (triggerId) {
        console.log('Deleting Trigger for retrieveResults...');
        GoogleSheetsHelper.deleteTrigger(triggerId);
        this.connector.setSystemVar(SystemVars.RETRIEVE_TRIGGER_ID, '');
      }
    }
  }
}

module.exports = GoogleSheetsExtension;
