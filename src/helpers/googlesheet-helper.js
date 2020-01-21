class GoogleSheetsApiHandler {
  fetch(url) {
    try{
      return UrlFetchApp.fetch(url);

    } catch(e){
      Logger.log('There was an error while fetching ' + url, e);
      Browser.msgBox('There was an error fetching a URL. Please run the '+
                     'commands "Authorize tool" and "Initialise tool" from the ' +
                     'AutoWebPerf menu.');
    }
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

    Logger.log('Sending GA pageview to ' + GA_ACCOUNT);

    // Record tests with perf budget.
    let response = this.fetch(this.GoogleAnalyticsPageViewURL(
      AWP_VERSION, activeSId, testedUrl, customValues));
    if (response) {
      Logger.log('GA Response status: ' + response.getContentText());
    }
  }

  /**
   * Tracking with pageview
   * @param {string} referral
   * @param {string} page
   * @param {string} pageTitle
   * @param {string} customValues Custom dimensions and metrics in 'cd1' or 'cm1' format.
   * @return {string}
   */
  GoogleAnalyticsPageViewURL(referral, page, pageTitle, customValues) {
    let customs = customValues ? Object.keys(customValues).map(x => x + '=' + customValues[x]) : [];
    // Random ID to prevent browser caching.
    let cache_buster = Math.round(Date.now() / 1000).toString();
    let clientEmail = getClientEmail();

    Logger.log(clientEmail);

    let params = [
      'v=1',
      't=pageview',
      'dl=' + page, // Tested URL as active Page
      'dr=https://' + encodeURI(referral), // Referral Source
      'ul=en-us',
      'de=UTF-8',
      'dt=' + pageTitle, // Page Title
      'cid=' + clientEmail || 'anonymous',
      'uid=' + clientEmail || 'anonymous',
      'tid=' + GA_ACCOUNT,
      'z=' + cache_buster,
      customs.join('&'),
    ];
    let trackingUrl = 'https://ssl.google-analytics.com/collect?' + params.join('&');
    return trackingUrl;
  }

  GoogleAnalyticsEventURL(spreadsheet, context, action) {
    // Random ID to prevent browser caching.
    var cache_buster = Math.round(Date.now() / 1000).toString();

    // Event Category set to Google Spreadsheets.
    var eventCategory =
        encodeURIComponent(spreadsheet || 'Unknown Google Spreadsheets');

    // Event Action set to spreadsheet title.
    var eventAction = encodeURIComponent(context || 'Unknown Context');

    // Event Label set to sheet title.
    var eventLabel = encodeURIComponent(action || 'Unknown Action');

    let clientEmail = getClientEmail();

    var trackingUrl = [
      'https://ssl.google-analytics.com/collect?',
      'v=1',
      't=event',
      'tid=' + GA_ACCOUNT,
      'cid=' + clientEmail,
      'uid=' + clientEmail,
      'z=' + cache_buster,
      'ec=' + eventCategory,
      'ea=' + eventAction,
      'el=' + eventLabel
    ].join('&');

    // Logger.log("trackingUrl: " + trackingUrl);

    return trackingUrl;
  }
}

export default {
  GoogleSheetsApiHandler,
};
