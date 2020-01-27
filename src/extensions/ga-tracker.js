'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const setObject = require('../utils/set-object');
const Extension = require('./extension');

class GATrackerExtension extends Extension {
  constructor(config) {
    super();
    config = config || {};
    assert(config.apiHandler, 'apiHandler is missing in config.');

    this.apiHandler = config.apiHandler;
    this.clientEmail = config.clientEmail;
    this.gaAccount = config.gaAccount;
    this.awpVersion = config.awpVersion;
  }

  postRun(test, result) {
    assert(test, 'test is missing.');
    assert(result, 'result is missing.');
  }

  postRetrieve(result) {
    assert(result, 'result is missing.');
  }

  /**
   * Tracking with pageview
   * @param {string} type
   * @param {string} testedUrl
   * @param {!object} values
   */
  trackAction(type, testedUrl, values) {
    let customValues = {
      // Custom dimensions as booleans
      'cd1': type,
      'cd2': values['hasBudgets'] || null,
      'cd3': values['underBudget-speedIndex'] || null,
      'cd4': values['underBudget-tti'] || null,
      'cd5': values['underBudget-js'] || null,
      'cd6': values['underBudget-css'] || null,
      'cd7': values['underBudget-font'] || null,
      'cd8': values['underBudget-images'] || null,
      'cd9': values['underBudget-video'] || null,
      // Custom metrics
      'cm1': values['speedIndex'] || null,
      'cm2': values['speedIndexBudget'] || null,
      'cm3': values['tti'] || null,
      'cm4': values['ttiBudget'] || null,
      'cm5': values['js'] || null,
      'cm6': values['jsBudget'] || null,
      'cm7': values['css'] || null,
      'cm8': values['cssBudget'] || null,
      'cm9': values['font'] || null,
      'cm10': values['fontBudget'] || null,
      'cm11': values['images'] || null,
      'cm12': values['imagesBudget'] || null,
      'cm13': values['video'] || null,
      'cm14': values['videoBudget'] || null,
    };

    config.log('Sending GA pageview to ' + this.gaAccount);

    // Record tests with perf budget.
    let response = this.fetch(this.GoogleAnalyticsPageViewURL(
      this.awpVersion, activeSId, testedUrl, customValues));
    if (response) {
      config.log('GA Response status: ' + response.getContentText());
    }
  }

  /**
   * Get tracking URL with pageview to Google Analytics
   * @param {string} referral
   * @param {string} page
   * @param {string} pageTitle
   * @param {string} customValues Custom dimensions and metrics in 'cd1' or 'cm1' format.
   * @return {string}
   */
  gaPageViewURL(params) {
    assert(params, 'params is missing in gaPageViewURL');

    let customValues = params.customValues;
    let customs = customValues ? Object.keys(customValues).map(x => x + '=' + customValues[x]) : [];
    // Random ID to prevent browser caching.
    let cacheBuster = Math.round(Date.now() / 1000).toString();

    let urlParams = [
      'v=1',
      't=pageview',
      'dl=' + params.page, // Tested URL as active Page
      'dr=https://' + encodeURI(params.referral), // Referral Source
      'ul=en-us',
      'de=UTF-8',
      'dt=' + params.pageTitle, // Page Title
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
   * @param  {type} context     description
   * @param  {type} action      description
   * @return {type}             description
   */
  gaEventURL(spreadsheetId, context, action) {
    // Random ID to prevent browser caching.
    var cacheBuster = Math.round(Date.now() / 1000).toString();

    // Event Category set to Google Spreadsheets.
    var eventCategory =
        encodeURIComponent(spreadsheetId || 'Unknown Google Spreadsheets');

    // Event Action set to spreadsheet title.
    var eventAction = encodeURIComponent(context || 'Unknown Context');

    // Event Label set to sheet title.
    var eventLabel = encodeURIComponent(action || 'Unknown Action');

    let clientEmail = getClientEmail();

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

    // config.log("trackingUrl: " + trackingUrl);

    return trackingUrl;
  }
}
