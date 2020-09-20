/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const {TestType} = require('../common/types');
const setObject = require('../utils/set-object');
const Extension = require('./extension');
const {AppScriptHelper, SystemVars} = require('../helpers/appscript-helper');

const TrackingType = {
  RESULT: 'Result',
  SUBMIT_SINGLE_TEST: 'SubmitManualTest', // Legacy name of single tests.
  SUBMIT_RECURRING_TEST: 'SubmitScheduledTest', // Legacy name of recurring tests.
  INIT: 'Initialise',
};

const RETRIEVE_PENDING_RESULTS_FUNC = 'retrievePendingResults';

/**
 * The extension for providing additional actions for AWP on AppScript.
 * In a nutshell, it provides the following additions:
 * - Before each run, convert location name to id based on location tab.
 * - After each run, convert location id to name based on location tab.
 * - After all runs, create trigger for retrieving results.
 * - After each retrieve, update modifiedDate and send analytic signals to
 *     Google Analytics.
 * - After all retrieves, delete trigger for
 *     retreiving results.
 */
class AppScriptExtension extends Extension {
  /**
   * @param {object} config The config for this extension, as the "appscript"
   *     property in awpConfig loaded from src/awp-core.js.
   */
  constructor(config, envVars) {
    super();
    assert(config.connector, 'connector is missing in config.');
    assert(config.apiHandler, 'apiHandler is missing in config.');
    assert(config.gaAccount, 'gaAccount is missing in config.');

    this.envVars = envVars;
    this.connector = config.connector;
    this.apiHandler = config.apiHandler;
    this.userTimeZone = AppScriptHelper.getUserTimeZone();
    this.clientEmail = AppScriptHelper.getClientEmail();
    this.spreadsheetId = AppScriptHelper.getSpreadsheetId();
    this.awpVersion = config.awpVersion || 'awp';
    this.gaAccount = config.gaAccount;
    this.locations = null;

    this.isSendTrackEvent = config.isSendTrackEvent || false;
    this.debug = config.debug || false;

    // Default values mappings.
    this.defaultResultValues = {
      'selected': false,
    };
  }

  /**
   * beforeRun - Convert location name to id based on location tab.
   * @param {object} context
   */
  beforeRun(context, options) {
    let test = context.test;

    // Update locations if there's WPT settings.
    if (test.webpagetest && test.webpagetest.settings) {
      this.locations = this.locations || this.connector.getList('locationsTab');
      this.locations.forEach(location => {
        if (test.webpagetest.settings.location === location.name) {
          test.webpagetest.settings.locationId = location.id;
        }
      });
    }
  }

  /**
   * afterRun - Convert location id to name based on location tab.
   * @param {object} context Context object that contains Test and Result objects.
   */
  afterRun(context, options) {
    let test = context.test;
    let result = context.result;

    // Update locations if there's WPT settings.
    if (test.webpagetest && test.webpagetest.settings) {
      // Replace locationId with location name.
      this.locations = this.locations || this.connector.getList('locationsTab');
      this.locations.forEach(location => {
        if (test.webpagetest.settings.locationId === location.id) {
          test.webpagetest.settings.location = location.name;
        }
      });
    }

    // Format recurring.nextTrigger with user's timezone.
    if (test.recurring) {
      if (test.recurring.nextTriggerTimestamp) {
        test.recurring.nextTriggerTime = AppScriptHelper.getFormattedDate(
            new Date(test.recurring.nextTriggerTimestamp), this.userTimeZone);
      } else {
        test.recurring.nextTriggerTime = '';
      }
    }

    if (result) {
      // Format createdDate
      if (result.createdTimestamp) {
        result.createdDate = AppScriptHelper.getFormattedDate(
            new Date(result.createdTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:mm:ss');
      }
      // Format modifiedDate
      if (result.modifiedTimestamp) {
        result.modifiedDate = AppScriptHelper.getFormattedDate(
            new Date(result.modifiedTimestamp), this.userTimeZone, 'MM/dd/YYYY HH:mm:ss');
      }

      // Send action to Google Analytics
      let type = result.type === TestType.SINGLE ?
          TrackingType.SUBMIT_SINGLE_TEST : TrackingType.SUBMIT_RECURRING_TEST;
      this.trackAction(type, this.spreadsheetId, result);

      // Send retrieved action to Google Analytics.
      if (result.status === Status.RETRIEVED) {
        this.trackAction(TrackingType.RESULT, this.spreadsheetId, result);
      }

      // Set default values if there's no value assigned for specific properties.
      Object.keys(this.defaultResultValues).forEach(key => {
        if (!result[key]) result[key] = this.defaultResultValues[key];
      });
    }
  }

  /**
   * afterAllRuns - create a trigger for retrieving results if not exists.
   * @param {object} context Context object that contains all processed Tests
   *     and Result objects.
   */
  afterAllRuns(context, options) {
    let tests = context.tests || [];
    let results = context.results || [];
    options = options || {};

    let pendingResults = results.filter(result => {
      return result.status === Status.SUBMITTED;
    });

    if (pendingResults.length > 0) {
      let triggerId = this.connector.getSystemVar(SystemVars.RETRIEVE_TRIGGER_ID);
      if (options.verbose) console.log(`${SystemVars.RETRIEVE_TRIGGER_ID} = ${triggerId}`);

      if (!triggerId) {
        triggerId = AppScriptHelper.createTimeBasedTrigger(
            RETRIEVE_PENDING_RESULTS_FUNC, 10 /* minutes */);
        this.connector.setSystemVar(SystemVars.RETRIEVE_TRIGGER_ID, triggerId);
        if (options.verbose) console.log(
            `Time-based Trigger created for RETRIEVE_PENDING_RESULTS_FUNC: ${triggerId}`);
      }
    }
  }

  /**
   * afterRetrieve - Update modifiedDate for the Result, and send analytics
   *     signals to Google Analytics.
   * @param {object} context Context object that contains the processed Result.
   */
  afterRetrieve(context, options) {
    let result = context.result;

    // Format modifiedDate
    if (result.modifiedTimestamp) {
      result.modifiedDate = AppScriptHelper.getFormattedDate(
          new Date(result.modifiedTimestamp), this.userTimeZone,
          'MM/dd/YYYY HH:mm:ss');
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
  afterAllRetrieves(context, options) {
    let appscript = (options || {}).appscript || {};

    // Skip when there's no newly updated results from the context.
    if (!context.results || context.results.length === 0) return;

    // Get all tabIds of results tabs.
    let resultsTabIds = Object.keys(this.connector.tabConfigs).filter(tabId => {
      return this.connector.tabConfigs[tabId].tabRole === 'results';
    });
    let pendingResults = [];

    // Get results from all Results tab.
    resultsTabIds.forEach(tabId => {
      let tabConfig = this.connector.tabConfigs[tabId];
      let results = this.connector.getResultList({
        appscript: {resultsTab: tabId},
        filters: [`status==="${Status.SUBMITTED}"`],
      });
      pendingResults = pendingResults.concat(results);
    });

    if (pendingResults.length === 0) {
      if (options.verbose) {
        console.log('Deleting Trigger for RETRIEVE_PENDING_RESULTS_FUNC...');
      }
      AppScriptHelper.deleteTriggerByFunction(RETRIEVE_PENDING_RESULTS_FUNC);
      this.connector.setSystemVar(SystemVars.RETRIEVE_TRIGGER_ID, '');
    }
  }

  /**
   * trackAction - Tracking with pageview
   *
   * @param {TrackingType} trackingType A TrackingType, e.g. TrackingType.RESULT.
   * @param {string} sheetId AppScript ID.
   * @param {object} result Processed Result object.
   */
  trackAction(trackingType, sheetId, result) {
    let testedUrl = result.url || result.origin || 'No given URL';
    let referral = this.awpVersion || 'awp';
    let url;

    // FIXME: Load the list of data sources from awpConfig instead of hardcoded.
    let dataSources = ['webpagetest', 'psi', 'cruxbigquery', 'cruxapi'];
    let activeDataSources = [];
    dataSources.forEach(dataSource => {
      if (result[dataSource]) {
        activeDataSources.push(dataSource);
      }
    });
    if (activeDataSources.length) {
      referral += '/' + activeDataSources.join('/');
    }

    // Record legacy GA event.
    if (this.isSendTrackEvent) {
      url = this.gaEventURL(sheetId, trackingType, testedUrl);

      this.apiHandler.fetch(url);

      if (this.debug) console.log(url);
    }

    // Record tests with perf budget with Pageview notation.
    let customValues = this.getCustomValues(trackingType, result) || {};

    url = this.gaPageViewURL(referral, sheetId, testedUrl, customValues);

    let response = this.apiHandler.fetch(url);

    if (this.debug) console.log('trackAction: ', url);
    if (this.debug && response.statusCode==200) {
      console.log('trackAction response: ', response.body);
    }
  }

  /**
   * trackError - Record an error event to Google Analytics.
   * @param {string} sheetId AppScript ID.
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
      let metrics = result.budgets.metrics || {};

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

  /**
   * Returns the AppScriptHelper for unit test purpose.
   * @return {object}
   */
  getAppScriptHelper() {
    return AppScriptHelper;
  }
}

module.exports = AppScriptExtension;
