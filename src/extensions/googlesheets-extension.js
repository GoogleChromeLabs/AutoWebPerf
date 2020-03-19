'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const {TestType} = require('../common/types');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const {GoogleSheetsHelper, SystemVars} = require('../helpers/googlesheets-helper');

const TrackingType = {
  RESULT: 'Result',
  SUBMIT_SINGLE_TEST: 'SubmitManualTest', // Legacy name of single tests.
  SUBMIT_RECURRING_TEST: 'SubmitScheduledTest', // Legacy name of recurring tests.
  INIT: 'Initialise',
};

/**
 * The extension for providing additional actions for AWP on GoogleSheets.
 * In a nutshell, it provides the following additions:
 * - Before each run, convert location name to id based on location tab.
 * - After each run, convert location id to name based on location tab.
 * - After all runs, create trigger for retrieving results.
 * - After each retrieve, update modifiedDate and send analytic signals to
 *     Google Analytics.
 * - After all retrieves, update to latestResultsTab and delete trigger for
 *     retreiving results.
 */
class GoogleSheetsExtension extends Extension {
  /**
   * @param {object} config The config for this extension, as the "googlesheets"
   *     property in awpConfig loaded from src/awp-core.js.
   */
  constructor(config) {
    super();
    assert(config.connector, 'connector is missing in config.');
    assert(config.apiHandler, 'apiHandler is missing in config.');
    assert(config.gaAccount, 'gaAccount is missing in config.');

    this.connector = config.connector;
    this.apiHandler = config.apiHandler;
    this.userTimeZone = GoogleSheetsHelper.getUserTimeZone();
    this.clientEmail = GoogleSheetsHelper.getClientEmail();
    this.spreadsheetId = GoogleSheetsHelper.getSpreadsheetId();
    this.awpVersion = config.awpVersion || 'awp-dev';
    this.gaAccount = config.gaAccount;
    this.locations = null;

    this.isSendTrackEvent = config.isSendTrackEvent || false;
    this.debug = config.debug || false;
  }

  /**
   * beforeRun - Convert location name to id based on location tab.
   * @param {object} context
   */
  beforeRun(context) {
    this.locations = this.locations || this.connector.getList('locationsTab');

    let test = context.test;
    this.locations.forEach(location => {
      if (test.webpagetest.settings.location === location.name) {
        test.webpagetest.settings.locationId = location.id;
      }
    });
  }

  /**
   * afterRun - Convert location id to name based on location tab.
   * @param {object} context Context object that contains Test and Result objects.
   */
  afterRun(context) {
    this.locations = this.locations || this.connector.getList('locationsTab');
    let test = context.test;
    let result = context.result;

    // Replace locationId with location name.
    this.locations.forEach(location => {
      if (test.webpagetest.settings.locationId === location.id) {
        test.webpagetest.settings.location = location.name;
      }
    });

    // Format recurring.nextTrigger with user's timezone.
    if (test.recurring) {
      if (test.recurring.nextTriggerTimestamp) {
        test.recurring.nextTriggerTime = GoogleSheetsHelper.getFormattedDate(
            new Date(test.recurring.nextTriggerTimestamp), this.userTimeZone);
      } else {
        test.recurring.nextTriggerTime = '';
      }
    }

    if (result) {
      // Format createdDate
      if (result.createdTimestamp) {
        result.createdDate = GoogleSheetsHelper.getFormattedDate(
            new Date(result.createdTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:MM');
      }
      // Format modifiedDate
      if (result.modifiedTimestamp) {
        result.modifiedDate = GoogleSheetsHelper.getFormattedDate(
            new Date(result.modifiedTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:MM');
      }

      // Send action to Google Analytics
      let type = result.type === TestType.SINGLE ?
          TrackingType.SUBMIT_SINGLE_TEST : TrackingType.SUBMIT_RECURRING_TEST;
      this.trackAction(type, this.spreadsheetId, result);

      // Send retrieved action to Google Analytics.
      if (result.status === Status.RETRIEVED) {
        this.trackAction(TrackingType.RESULT, this.spreadsheetId, result);
      }
    }
  }

  /**
   * afterAllRuns - create a trigger for retrieving results if not exists.
   * @param {object} context Context object that contains all processed Tests
   *     and Result objects.
   */
  afterAllRuns(context) {
    let tests = context.tests || [];
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

  /**
   * afterRetrieve - Update modifiedDate for the Result, and send analytics
   *     signals to Google Analytics.
   * @param {object} context Context object that contains the processed Result.
   */
  afterRetrieve(context) {
    let result = context.result;

    // Format modifiedDate
    if (result.modifiedTimestamp) {
      result.modifiedDate = GoogleSheetsHelper.getFormattedDate(
          new Date(result.modifiedTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:MM');
    }

    // Send retrieved action to Google Analytics.
    if (result.status === Status.RETRIEVED) {
      this.trackAction(TrackingType.RESULT, this.spreadsheetId, result);
    }
  }

  /**
   * afterAllRetrieves - Collect all latest retrieved Results for each label,
   *     and delete the trigger for retrieving results if all results are done.
   * @param {object} context Context object that contains all processed Tests
   *     and Result objects.
   */
  afterAllRetrieves(context) {
    // Get all results in the tab.
    let results = this.connector.getResultList();
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

  /**
   * trackAction - Tracking with pageview
   *
   * @param {TrackingType} trackingType A TrackingType, e.g. TrackingType.RESULT.
   * @param {string} sheetId GoogleSheets ID.
   * @param {object} result Processed Result object.
   */
  trackAction(trackingType, sheetId, result) {
    let testedUrl = result.url;
    let url;

    // Record legacy GA event.
    if (this.isSendTrackEvent) {
      url = this.gaEventURL(sheetId, trackingType, testedUrl);
      this.apiHandler.fetch(url);

      if (this.debug) console.log(url);
    }

    // Record tests with perf budget with Pageview notation.
    let customValues = this.getCustomValues(trackingType, result) || {};

    url = this.gaPageViewURL(this.awpVersion, sheetId, testedUrl, customValues);
    let response = this.apiHandler.fetch(url);
    if (this.debug) console.log('trackAction: ', url);

    if (response && this.debug) {
      console.log('trackAction response: ', response);
    }
  }

  /**
   * trackError - Record an error event to Google Analytics.
   * @param {string} sheetId GoogleSheets ID.
   * @param {string} errorStr Error details.
   */
  trackError(sheetId, errorStr) {
    this.apiHandler.fetch(this.gaEventURL(sheetId, 'Error', errorStr));
  }

  /**
   * getCustomValues - Return the object of full list of custom metrics and
   *     dimensions used for tracking with GoogleAnalytics.
   * @param {TrackingType} trackingType A TrackingType, e.g. TrackingType.RESULT.
   * @param {object} result Processed Result object.
   */
  getCustomValues(trackingType, result) {
    if (result.budgets) {
      let hasBudgets = false;
      let underBudgets = {};
      let budgets = result.budgets.budget || {};
      let metrics = result.budgets.metrics;

      Object.keys(budgets).forEach(key => {
        if (budgets[key] > 0) hasBudgets = true;
        if (metrics[key] && metrics[key].overRatio >= 0) {
          underBudgets[key] = true;
        }
      });

      return {
        'cd1': trackingType,
        // Custom dimensions as booleans
        'cd2': hasBudgets || null,
        'cd3': underBudgets['SpeedIndex'] || null,
        'cd4': underBudgets['TimeToInteractive'] || null,
        'cd5': underBudgets['Javascript'] || null,
        'cd6': underBudgets['CSS'] || null,
        'cd7': underBudgets['Fonts'] || null,
        'cd8': underBudgets['Images'] || null,
        'cd9': underBudgets['Videos'] || null,
        'cd10': underBudgets['FirstContentfulPaint'] || null,

        // Custom metrics
        'cm1': (metrics['SpeedIndex'] || {}).metricsValue || null,
        'cm2': budgets['SpeedIndex'] || null,
        'cm3': (metrics['TimeToInteractive'] || {}).metricsValue || null,
        'cm4': budgets['TimeToInteractive'] || null,
        'cm5': (metrics['Javascript'] || {}).metricsValue || null,
        'cm6': budgets['Javascript'] || null,
        'cm7': (metrics['CSS'] || {}).metricsValue || null,
        'cm8': budgets['CSS'] || null,
        'cm9': (metrics['Fonts'] || {}).metricsValue || null,
        'cm10': budgets['Fonts'] || null,
        'cm11': (metrics['Images'] || {}).metricsValue || null,
        'cm12': budgets['Images'] || null,
        'cm13': (metrics['Videos'] || {}).metricsValue || null,
        'cm14': budgets['Videos'] || null,
        'cm15': (metrics['FirstContentfulPaint'] || {}).metricsValue || null,
        'cm16': budgets['FirstContentfulPaint'] || null,
      };
    } else {
      return {};
    }
  }

  /**
   * Get tracking URL with pageview to Google Analytics
   * @param {string} referral
   * @param {string} sheetId
   * @param {string} testedUrl
   * @param {string} customValues Custom dimensions and metrics in 'cd1' or 'cm1' format.
   * @return {string}
   */
  gaPageViewURL(referral, sheetId, testedUrl, customValues) {
    assert(referral, 'referral is missing in gaPageViewURL');
    assert(sheetId, 'sheetId is missing in gaPageViewURL');
    assert(testedUrl, 'testedUrl is missing in gaPageViewURL');

    let customs = customValues ? Object.keys(customValues).map(x => x + '=' + customValues[x]) : [];
    // Random ID to prevent browser caching.
    let cacheBuster = Math.round(Date.now() / 1000).toString();

    let urlParams = [
      'v=1',
      't=pageview',
      'dl=' + sheetId, // Tested URL as active Page
      'dr=https://' + encodeURI(referral), // Referral Source
      'ul=en-us',
      'de=UTF-8',
      'dt=' + testedUrl, // Page Title
      'cid=' + this.clientEmail || 'anonymous',
      'uid=' + this.clientEmail || 'anonymous',
      'tid=' + this.gaAccount,
      'z=' + cacheBuster,
      customs.join('&'),
    ];
    let trackingUrl = 'https://ssl.google-analytics.com/collect?' + urlParams.join('&');
    return trackingUrl;
  }

  /**
   * Get tracking URL with event to Google Analytics
   * @param  {type} spreadsheetId description
   * @param  {type} action     description
   * @param  {type} label      description
   * @return {type}             description
   */
  gaEventURL(spreadsheetId, action, label) {
    // Random ID to prevent browser caching.
    var cacheBuster = Math.round(Date.now() / 1000).toString();
    let clientEmail = this.clientEmail;

    // Event Category set to Google Spreadsheets.
    var eventCategory =
        encodeURIComponent(spreadsheetId || 'Unknown Google Spreadsheets');

    // Set event action as functions, like runTest, amountBatchAutoTests, etc.
    var eventAction = encodeURIComponent(action || 'Unknown Action');

    // Set label as tested URLs
    var eventLabel = encodeURIComponent(label || 'Unknown Label');

    var trackingUrl = [
      'https://ssl.google-analytics.com/collect?',
      'v=1',
      't=event',
      'tid=' + this.gaAccount,
      'cid=' + clientEmail,
      'uid=' + clientEmail,
      'z=' + cacheBuster,
      'ec=' + eventCategory,
      'ea=' + eventAction,
      'el=' + eventLabel
    ].join('&');

    return trackingUrl;
  }
}

module.exports = GoogleSheetsExtension;
