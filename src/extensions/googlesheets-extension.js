'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const {GoogleSheetsHelper} = require('../helpers/googlesheets-helper');

class GoogleSheetsExtension extends Extension {
  constructor(config) {
    super();
    assert(config.connector, 'connector is missing in config.');
    this.connector = config.connector;
    this.locations = null;

    this.recieveTriggerSystemVar = 'RETRIEVE_TRIGGER_ID';
    this.recurringTriggerSystemVar = 'RECURRING_TRIGGER_ID';
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
    this.locations.forEach(location => {
      if (test.webpagetest.settings.locationId === location.id) {
        test.webpagetest.settings.locationId = location.name;
      }
    });
  }

  beforeAllRun(params) {}

  afterAllRuns(params) {
    let tests = params.tests || [];

    if (tests.length > 0) {
      let triggerId = this.connector.getSystemVar(this.recieveTriggerSystemVar);
      console.log(`${this.recieveTriggerSystemVar} = ${triggerId}`);

      if (!triggerId) {
        console.log('Creating Trigger for retrieveResults...');

        triggerId = GoogleSheetsHelper.createTrigger('retrieveResults', 10 /* minutes */);
        this.connector.setSystemVar(this.recieveTriggerSystemVar, triggerId);
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
      let triggerId = this.connector.getSystemVar(this.recieveTriggerSystemVar);
      console.log(`${this.recieveTriggerSystemVar} = ${triggerId}`);

      if (triggerId) {
        console.log('Deleting Trigger for retrieveResults...');
        GoogleSheetsHelper.deleteTrigger(triggerId);
        this.connector.setSystemVar(this.recieveTriggerSystemVar, '');
      }
    }
  }
}

module.exports = GoogleSheetsExtension;
