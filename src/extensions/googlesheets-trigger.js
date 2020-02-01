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

  beforeAllRun(tests, results) {
    let triggerId = this.connector.getSystemVar(this.recieveTriggerSystemVar);
  }

  afterAllRun(tests, results) {
    let triggerId = this.connector.getSystemVar(this.recieveTriggerSystemVar);
    if (!triggerId) {
      triggerId = GoogleSheetsHelper.createTrigger('retrieveResults', 10 /* minutes */);
      this.connector.setSystemVar(this.recieveTriggerSystemVar, triggerId);
    }
  }

  afterAllRetrieve(tests, results) {
    let triggerId = this.connector.getSystemVar(this.recieveTriggerSystemVar);
    if (triggerId) {
      GoogleSheetsHelper.deleteTrigger(this.recieveTriggerSystemVar);
    }
  }
}

module.exports = BudgetsExtension;
