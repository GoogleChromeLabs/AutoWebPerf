'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const {GoogleSheetsHelper} = require('../helpers/googlesheets-helper');

class GoogleSheetsTriggerExtension extends Extension {
  constructor(config) {
    super();
    assert(config.connector, 'connector is missing in config.');
    this.connector = config.connector;

    this.recieveTriggerSystemVar = 'RETRIEVE_TRIGGER_ID';
    this.recurringTriggerSystemVar = 'RECURRING_TRIGGER_ID';
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

module.exports = GoogleSheetsTriggerExtension;
