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

class GoogleSheetsHelper {
  /**
   * Return a system variable.
   * @param {string} key
   * @return {string}
   */
  getSysVar(key) {
    return documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).getValue();
  };

  /**
   * Set a system variable.
   * @param {string} key
   * @param {string} value
   */
  setSysVar(key, value) {
    documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).setValue(value);
  };

  /**
   * Set a system variable.
   * @param {string} key
   */
  deleteSysVar(key) {
    documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).clearContent();
  };

  /**
   * Encrypt a string to MD5.
   * @param {string} message
   * @return {string}
   */
  toMD5(message) {
    message = message || 'thisisteststring';
    var signature = Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5, message, Utilities.Charset.US_ASCII);
    var signatureStr = '';
    for (i = 0; i < signature.length; i++) {
      var byte = signature[i];
      if (byte < 0) byte += 256;
      var byteStr = byte.toString(16);
      // Ensure we have 2 chars in our byte, pad with 0
      if (byteStr.length == 1) byteStr = '0' + byteStr;
      signatureStr += byteStr;
    }
    return signatureStr;
  };

  /**
   * Deletes a trigger.
   * @param {string} triggerId The Trigger ID.
   */
  deleteTrigger(triggerId) {
    // Loop over all triggers.
    var allTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < allTriggers.length; i++) {
      // If the current trigger is the correct one, delete it.
      if (allTriggers[i].getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(allTriggers[i]);
        break;
      }
    }
  };

  /**
   * Deletes all triggers.
   * @param {string} triggerId The Trigger ID.
   */
  deleteAllTriggers(triggerId) {
    // Loop over all triggers.
    var allTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < allTriggers.length; i++) {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  };

  /**
   * Queries URL and returns JSON response.
   * @param {string} apiURL
   * @return {string}
   */
  getPardsedJSONData(apiURL) {
    if (!apiURL) return;
    var response = this.fetchUrl(apiURL);
    if (!response) return;
    var data = JSON.parse(response.getContentText());
    if (!data) {
      if (API_retries++ < 20) {
        Utilities.sleep(500 * API_retries);
        return this.getPardsedJSONData(apiURL);
      }
    } else {
      // Logger.log("retries: " + API_retries);
      API_retries = 0;
      return data;
    }
  };

  /**
   * Write data in sheet.
   * @param {object!} sheet
   * @param {object!} headerMap
   * @param {number} row
   * @param {object!} columnValueMap
   */
  writeData(sheet, headerMap, row, columnValueMap) {
    Object.keys(columnValueMap).forEach(function(columnName) {
      if (headerMap[columnName] >= 0) {
        var thisRange = sheet.getRange(row, headerMap[columnName] + 1);
        thisRange.setValue(columnValueMap[columnName]);
        if (columnName == 'run') {
          var rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
          thisRange.setDataValidation(rule);
        }
      }
    });
  };

  /**
   * Write to Results tab.
   * @param {number} row
   * @param {object!} columnValueMap
   */
  writeResults(row, columnValueMap) {
    this.writeData(resultsSheet, resultsHeader, row, columnValueMap);
  };

  /**
   * Return formatted date according to user's calendar setting.
   * @param {!date} dateInput
   * @return {!date}
   */
  getFormattedDate(dateInput) {
    return Utilities.formatDate(
        dateInput, this.getSysVar('USER_TIMEZONE'),
        defaultTestSettings.timeFormat);
  };

  /**
   * When spreadsheet is edited, set timestamps.
   */
  setTimestamps() {
    var testsData = testsSheet.getDataRange().getValues();
    var numRows = testsSheet.getLastRow();
    for (var i = 2; i < numRows; i++) {
      var fequency = testsData[i][testsHeader.frequency];
      var currentFrequency = testsData[i][testsHeader.currentFrequency];
      // Check if fequecies were edited and set timestamp.
      if (fequency != currentFrequency) {
        this.setIndividualTimestamp(i, fequency);
      }
    }
  };

  /**
   * Set an individual timestamp for a row
   * @param {number} testIndex
   * @param {string} frequencyLabel
   */
  setIndividualTimestamp(testIndex, frequencyLabel) {
    var nextTimestampCell =
        testsSheet.getRange(testIndex + 1, testsHeader.nextTimestamp + 1);
    var now = new Date();
    var nowS = now.getTime() / 1000;

    if (frequencyLabel && frequencyLabel != NO_FREQUENCY) {
      var frequencyS = getFrequencyMinutes(frequencyLabel) * 60;
      var nextTimestampUpdate = nowS + frequencyS;
      nextTimestampCell.setValue(nextTimestampUpdate.toString());
    } else {
      nextTimestampCell.clearContent();
    }
    this.updateNextTriggerDate(testIndex + 1, nextTimestampUpdate);
    this.writeData(
        testsSheet, testsHeader, testIndex + 1,
        {'currentFrequency': frequencyLabel});
  };

  /**
   * Update nextTrigger Date from Tests
   * @param {number} testIndex
   * @param {number} timestampInput
   */
  updateNextTriggerDate(testIndex, timestampInput) {
    var timeData = (timestampInput) ?
        this.getFormattedDate(new Date(timestampInput * 1000)) :
        '';
    this.writeData(
        testsSheet, testsHeader, testIndex, {'nextTriggerDate': timeData});
  };

  /**
   * Retrieve WPT API Key.
   * @return {string}
   */
  retrieveUserKey() {
    return userApiKeySheet.getRange(2, 2).getValue();
  };

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
}

export default {
  GoogleSheetsApiHandler,
  GoogleSheetsHelper,
};
