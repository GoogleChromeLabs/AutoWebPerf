// see WPT API here.
// https://sites.google.com/a/webpagetest.org/docs/advanced-features/webpagetest-restful-apis.
var SERVER_URL = 'https://webpagetest.org';
var WPT_getLocationsURL =
    'http://www.webpagetest.org/getLocations.php?f=json&k=A';
var LOCATION = 'London_EC2:Chrome';
var NO_FREQUENCY = '-- None --';
var SCHEDULED_PRIORITY = 5;
var TRACKING_TYPE = {
  'Result': 'Result',
  'SubmitManualTest': 'Submit Manual Test',
  'SubmitScheduledTest': 'Submit Scheduled Test',
  'Initialise': 'Initialise',
};

var TESTTYPE = {'MANUAL': 'Manual', 'SCHEDULED': 'Scheduled'};

var STATUSES = {
  'RETRIEVED': 'Retrieved',
  'CANCELLED': 'Test Cancelled',
  'ERROR': 'ERROR'
};

var metrics = [
  'data.median.firstView[\'lighthouse.Performance\']',
  'data.median.firstView[\'lighthouse.ProgressiveWebApp\']',
  'data.median.firstView[\'lighthouse.Performance.first-meaningful-paint\']',
  'data.median.firstView[\'lighthouse.Performance.interactive\']',

  'data.median.firstView.SpeedIndex', 'data.median.firstView.TTFB',
  'data.median.firstView.render', 'data.median.firstView.visualComplete',
  'data.median.firstView.TTIMeasurementEnd', 'data.median.firstView.loadTime',
  'data.median.firstView.requestsDoc',
  'data.median.firstView.domContentLoadedEventStart',
  'data.median.firstView.bytesIn', 'data.median.firstView.domElements',

  'data.median.firstView.breakdown.css.bytes',
  'data.median.firstView.breakdown.font.bytes',
  'data.median.firstView.breakdown.js.bytes',
  'data.median.firstView.breakdown.image.bytes',
  'data.median.firstView.breakdown.video.bytes'
];

var activeSpreadsheet = SpreadsheetApp.getActive();
var activeSId = activeSpreadsheet.getId();
var testsSheet = activeSpreadsheet.getSheetByName('Tests');
var resultsSheet = activeSpreadsheet.getSheetByName('Results');
var locationsSheet = activeSpreadsheet.getSheetByName('Locations');
var compareSheet = activeSpreadsheet.getSheetByName('Comparison');
var frequencySheet = activeSpreadsheet.getSheetByName('schedule_frequency');
var userApiKeySheet = activeSpreadsheet.getSheetByName('User_API_Key');
var documentPropertiesSheet = activeSpreadsheet.getSheetByName('Document_Properties');
var perfBudgetDashSheet = activeSpreadsheet.getSheetByName('Perf Budget Dashboard');


var defaultTestSettings = {
  connection: '3GFast',
  run: 1,
  fvOnly: 1,
  timeline: 1,
  timeZone: 'GMT',
  timeFormat: 'MM/dd/YY HH:mm'
};

var testsHeader = {
  run: 0,
  url: 1,
  label: 2,
  frequency: 3,
  nextTriggerDate: 4,
  nextTimestamp: 5,
  currentFrequency: 6,
  location: 7,
  pending: 8,
  device: 9,
  connection: 10,
  runs: 11,
  repeatView: 12,
  timeline: 13,
  block: 14,
  script: 15,
  speedIndexBudget: 16,
  TTIBudget: 17,
  jsBudget: 18,
  cssBudget: 19,
  fontBudget: 20,
  imagesBudget: 21,
  videoBudget: 22,
  testId: 23
};

var resultsHeader = {
  run: 0,
  testType: 1,
  status: 2,
  label: 3,
  url: 4,
  date: 5,
  wptLink: 6,
  performanceScore: 7,
  PWAScore: 8,
  FMP: 9,
  firstInteractive: 10,
  speedIndex: 11,
  TTFB: 12,
  startRenderTime: 13,
  visuallyCompleteTime: 14,
  TTI: 15,
  loadTime: 16,
  requests: 17,
  DCL: 18,
  size: 19,
  elements: 20,
  css: 21,
  font: 22,
  js: 23,
  images: 24,
  video: 25,
  testId: 26,
  connection: 27,
  runs: 28,
  fvOnly: 29,
  timeline: 30,
  block: 31,
  script: 32,
  jsonUrl: 33,
  speedIndexBudget: 34,
  speedIndexBudgetDelta: 35,
  TTIBudget: 36,
  TTIBudgetDetla: 37,
  jsBudget: 38,
  jsBudgetDelta: 39,
  cssBudget: 40,
  cssBudgetDelta: 41,
  fontBudget: 42,
  fontBudgetDelta: 43,
  imagesBudget: 44,
  imagesBudgetDelta: 45,
  videoBudget: 46,
  videoBudgetDelta: 47
};

// When received result, print it from the column of performanceScore.
resultsHeader.offset = resultsHeader.performanceScore;

var compareHeader =
    {row: 0, testId: 1, label: 2, repeat: 3, step: 4, run: 5, end: 6};

var compareConfig = {repeatView: false};


var SYSVARS = {
  'IS_MANUAL_RETRIEVE': 0,
  'IS_MANUAL_SUBMIT': 1,
  'TRIGGER_RETRIEVE': 2,
  'TRIGGER_SUBMIT_SCHEDULED': 3,
  'USER_TIMEZONE': 4
};

// Each element represents the range for a certain score: [minpoint, midpoint,
// maxpoint] Below lowerbound: showing red, over upperbound: showing green.
// Midpoint, yellow. If upperbound is less than lowerbound, the color scale will
// be inverted. E.g. the lower FCP, the better. If the range is an empty array,
// null or undefined, it won't set conditional format for that column.
var resultColumnConditions = {
  'FCP': [5000, 4000, 2000],
  'FID': [300, 250, 50],
  'DCL': [7000, 3500, 2000],
  'Performance Score': [0.4, 0.74, 0.75],
  'PWA Score': [0.4, 0.74, 0.75],
  'FMP': [5500, 4500, 2500],
  'First Interactive': [8000, 7000, 5000],
  'Speed Index': [8000, 4500, 3000],
  'TTFB': [4000, 2000, 1000],
  'Start Render Time': [4500, 3000, 1500],
  'Visually Complete Time': [8000, 4500, 3000],
  'TTI (LH)': [8000, 7000, 5000],
  'TTI (WPT)': [8000, 7000, 5000],
  'Load Time': [10000, 6500, 5000],
  'Requests': [],
  'Size': [],
  'Elements': [],
  'CSS': [],
  'Font': [],
  'JS': [],
  'Images': [],
  'Video': [],
  'WPT ID': [],
  'Connection': [30, 20, 10],
  'Runs': [],
  'FV Only': [],
  'Timeline': [],
  'Block': [],
  'Script': [],
  'JSON URL': []
};

var API_retries = 0;

var clientEmail;

/**
 * Helper object.
 */
var Helper = {};

/**
 * Return a system variable.
 * @param {string} key
 * @return {string}
 */
Helper.getSysVar = function(key) {
  return documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).getValue();
};

/**
 * Set a system variable.
 * @param {string} key
 * @param {string} value
 */
Helper.setSysVar = function(key, value) {
  documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).setValue(value);
};

/**
 * Set a system variable.
 * @param {string} key
 */
Helper.deleteSysVar = function(key) {
  documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).clearContent();
};

/**
 * Encrypt a string to MD5.
 * @param {string} message
 * @return {string}
 */
Helper.toMD5 = function(message) {
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
Helper.deleteTrigger = function(triggerId) {
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
Helper.deleteAllTriggers = function(triggerId) {
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
Helper.getPardsedJSONData = function(apiURL) {
  if (!apiURL) return;
  var response = Helper.fetchUrl(apiURL);
  if (!response) return;
  var data = JSON.parse(response.getContentText());
  if (!data) {
    if (API_retries++ < 20) {
      Utilities.sleep(500 * API_retries);
      return Helper.getPardsedJSONData(apiURL);
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
Helper.writeData = function(sheet, headerMap, row, columnValueMap) {
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
Helper.writeResults = function(row, columnValueMap) {
  Helper.writeData(resultsSheet, resultsHeader, row, columnValueMap);
};

/**
 * Return formatted date according to user's calendar setting.
 * @param {!date} dateInput
 * @return {!date}
 */
Helper.getFormattedDate = function(dateInput) {
  return Utilities.formatDate(
      dateInput, Helper.getSysVar('USER_TIMEZONE'),
      defaultTestSettings.timeFormat);
};

/**
 * When spreadsheet is edited, set timestamps.
 */
Helper.setTimestamps = function() {
  var testsData = testsSheet.getDataRange().getValues();
  var numRows = testsSheet.getLastRow();
  for (var i = 2; i < numRows; i++) {
    var fequency = testsData[i][testsHeader.frequency];
    var currentFrequency = testsData[i][testsHeader.currentFrequency];
    // Check if fequecies were edited and set timestamp.
    if (fequency != currentFrequency) {
      Helper.setIndividualTimestamp(i, fequency);
    }
  }
};

/**
 * Set an individual timestamp for a row
 * @param {number} testIndex
 * @param {string} frequencyLabel
 */
Helper.setIndividualTimestamp = function(testIndex, frequencyLabel) {
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
  Helper.updateNextTriggerDate(testIndex + 1, nextTimestampUpdate);
  Helper.writeData(
      testsSheet, testsHeader, testIndex + 1,
      {'currentFrequency': frequencyLabel});
};

/**
 * Update nextTrigger Date from Tests
 * @param {number} testIndex
 * @param {number} timestampInput
 */
Helper.updateNextTriggerDate = function(testIndex, timestampInput) {
  var timeData = (timestampInput) ?
      Helper.getFormattedDate(new Date(timestampInput * 1000)) :
      '';
  Helper.writeData(
      testsSheet, testsHeader, testIndex, {'nextTriggerDate': timeData});
};

/**
 * Retrieve WPT API Key.
 * @return {string}
 */
Helper.retrieveUserKey = function() {
  return userApiKeySheet.getRange(2, 2).getValue();
};

/**
 * Fetch URLs with a consistent try/catch block to handle permission issues
 * @param {string} url
 * @return {!object}
 */
Helper.fetchUrl = function(url) {
  try{
    return UrlFetchApp.fetch(url);
  } catch(e){
    Logger.log('There was an error while fetching ' + url, e);
    Browser.msgBox('There was an error fetching a URL. Please run the '+
                   'commands "Authorize tool" and "Initialise tool" from the ' +
                   'AutoWebPerf menu.');
  }
};

/**
 * Binded to onOpen function:
 * Adds AutoWebPerf menu, with actions to submit tests, check their progress and
 * clear results. Builds the location dropdown from WPT API.
 */
function onStart() {
  onStartFunc();
}

/**
 * When spreadsheet is edited.
 * @param {!object} e
 */
function onEdit(e) {
  // Check which sheed and column has been edited.
  var range = e.range;
  var sheet = range.getSheet().getName();
  var columnId = range.getColumn();
  // Check if fequency column was edited.
  if (sheet == 'Tests' && columnId == testsHeader.frequency + 1) {
    Helper.setTimestamps();
  }
}

/**
 * Generic onStart steps.
 */
function onStartFunc() {
  if (!Helper.retrieveUserKey()) {
    var message = false;
    requestUserKey(message);
  }
  initConditionalFormat();
  createSubmitTrigger();
  getUserTimezone();
}

/**
* Function to let the user check if they are authorized
*/
function onAuthorize(){
  Helper.fetchUrl(GoogleAnalyticsEventURL(
      activeSId, 'onStart', 'onStart'));  // Save to analytics.
  Browser.msgBox('This sheet has been authorized!');
}

/**
 * Request WPT API Key.
 * @param {string} message
 */
function requestUserKey(message) {
  var apiKey = Helper.retrieveUserKey();
  message = (message) ? message : 'Enter your WebPageTest API Key';
  var requestCnt = 0;
  while (!apiKey && requestCnt < 3) {
    var input = Browser.inputBox(
        message + ' (register at https://www.webpagetest.org/getkey.php)');
    // The input will be 'cancel' if the user uses the close button on top
    if (input !== 'cancel') {
      apiKey = input;
    } else {
      break;
    }
    requestCnt = requestCnt + 1;
  }
  if (apiKey) {
    userApiKeySheet.getRange(2, 2).setValue(apiKey);
  } else {
    Browser.msgBox('A WebPageTest API Key is required for this tool to' +
                   ' function. Please enter one on the hidden User_API_Key' +
                   ' tab to continue using this tool.');
  }
}

/**
 * Initialise spreadsheet data (manual trigger necessary when copying master
 * spreadsheet).
 */
function initialise() {
  // Reset all triggers.
  Helper.deleteAllTriggers();
  Helper.setSysVar('TRIGGER_RETRIEVE', '');
  Helper.setSysVar('TRIGGER_SUBMIT_SCHEDULED', '');

  // Generic on start.
  onStartFunc();

  // Methods requiring authorization. These will fail if called from simple
  // triggers like onOpen() or onEdit()
  getLocations();

  // Reset formulas in case of accidental removal.
  resetFormulas();

  Helper.fetchUrl(GoogleAnalyticsEventURL(
      activeSId, 'initialise', 'initialise'));  // Save to analytics.
}

/**
 * Function to get client email. This will always set clientEmail to anonymous
 * if called from a simple trigger like onOpen(), even if the sheet is authorized
 * @return {string}
 */
function getClientEmail() {
  //Set email
  let clientEmail = Session.getActiveUser().getEmail();
  return clientEmail ? Helper.toMD5(clientEmail) : 'anonymous';
}

/**
 * Get user timezone from calendar and set it as system var.
 */
function getUserTimezone() {
  try {
    var userTimeZone = CalendarApp.getDefaultCalendar().getTimeZone();
    if (Helper.getSysVar('USER_TIMEZONE') != userTimeZone) {
      Helper.setSysVar('USER_TIMEZONE', userTimeZone);
      updateNextTriggerDates();
    }
  } catch (e) {
    Helper.setSysVar('USER_TIMEZONE', defaultTestSettings.timeZone);
  }
}

/**
 * Extracts parameters from spreadsheet and submits tests to WPT.
 */
function submitManualTests() {
  // Can't be used without own API key.
  if (!Helper.retrieveUserKey() || Helper.retrieveUserKey() === '') {
    requestUserKey(
        'Please obtain first a valid webpagetest API key to use this tool');
    return;
  }

  activeSpreadsheet.toast(
      'Submitting new tests to WPT, this will be quick!', 'Status', 10);

  var submitted = 0;  // Track how many tests were submitted.
  var numTests = 0;
  var numTestsRange =
      testsSheet.getRange(3, 1, testsSheet.getLastRow() - 2, 1).getValues();
  for (var i = 0; i < numTestsRange.length; i++) {
    if (numTestsRange[i][0] == true) {
      numTests++;
    }
  }

  if (numTests == 0) {
    activeSpreadsheet.toast(
        'No URLs flagged to run. Task finished.', 'Status', 10);
    return;
  }

  // Default API priority is 2, the more tests are requested the lower priority
  // will be assigned.
  var priority = 2;
  if (numTests <= 10) {
    priority = 2;
  } else if (numTests > 10 && numTests < 50) {
    priority = 3;
  } else if (numTests >= 50 && numTests < 100) {
    priority = 4;
  } else if (numTests >= 100) {
    priority = 5;
  }

  var testsData = testsSheet.getDataRange().getValues();
  var lastRow = testsSheet.getLastRow();
  for (var i = 2; i < lastRow; i++) {
    if (testsData[i][testsHeader.run]) {
      Helper.setSysVar('IS_MANUAL_SUBMIT', 'true');
      submitIndividualTest(testsData[i], i, priority);
      submitted++;
    }
  }
  activeSpreadsheet.toast('Finished!', 'Status', 10);
  Helper.setSysVar('IS_MANUAL_RETRIEVE', 'true');
  retrieveResults();
  getLocations();

  // Save to analytics.
  Helper.fetchUrl(
      GoogleAnalyticsEventURL(activeSId, 'amountBatchRunTests', submitted));
}

/**
 * Submits a single test to WPT.
 * @param {!object} testData
 * @param {number} testIndex
 * @param {number} testPriority
 */
function submitIndividualTest(testData, testIndex, testPriority) {
  var url = testData[testsHeader.url];
  var label = testData[testsHeader.label];
  var translatedLocation = testData[testsHeader.location];
  var location = getLocationId(translatedLocation);
  var device = testData[testsHeader.device].toString();
  var isDeviceLocation = false;
  // Use Chrome Browser exclusively
  var browser = 'Chrome';  // testData[testsHeader.browser];
  var connection = testData[testsHeader.connection];
  var runs = testData[testsHeader.runs];
  var fvOnly = testData[testsHeader.repeatView].toString();
  var timeline = testData[testsHeader.timeline].toString();
  var block = testData[testsHeader.block];
  var script = encodeURIComponent(testData[testsHeader.script]);
  var frequency = testData[testsHeader.frequency];
  // Copy over current performance budgets
  var speedIndexBudget = testData[testsHeader.speedIndexBudget] * 1000;
  var ttiBudget = testData[testsHeader.TTIBudget] * 1000;
  var jsBudget = testData[testsHeader.jsBudget];
  var cssBudget = testData[testsHeader.cssBudget];
  var fontBudget = testData[testsHeader.fontBudget];
  var imagesBudget = testData[testsHeader.imagesBudget];
  var videoBudget = testData[testsHeader.videoBudget];
  // Detect Locations from Real Devices, they often contains "_" symbol
  // except for London_EC2 location.
  if (location && location !== 'London_EC2' &&
      location.indexOf('_') !== -1) {
    isDeviceLocation = true;
  }

  // Append HTTP protocol if missing from URL.
  if (url.indexOf('http') == -1) {
    url = 'http://' + url;
  }

  var fullLocation = location + ':' + browser + '.' + connection;

  if (connection == '') {
    connection = defaultTestSettings.connection;
  }

  if (fvOnly == '') {
    fvOnly = defaultTestSettings.fvOnly;
  }
  fvOnly = (fvOnly == 'true') ? 0 : 1;

  if (timeline == '') {
    timeline = defaultTestSettings.timeline;
  }
  timeline = (timeline == 'true' || timeline == 1) ? 1 : 0;

  if (runs == '') {
    runs = defaultTestSettings.run;
  }
  var wptAPI = SERVER_URL + '/runtest.php?k=' + Helper.retrieveUserKey() +
      '&location=' + fullLocation + '&url=' + encodeURIComponent(url) +
      '&priority=' + testPriority + '&f=json' +
      '&video=1' +
      '&lighthouse=1' +
      '&runs=' + runs + '&fvonly=' + fvOnly + '&label=' + label +
      '&timeline=' + timeline + ((block != '') ? ('&block=' + block) : '') +
      ((script != '') ? ('&script=' + script) : '');

  // Enable Mobile Emulation only if a Mobile Device has been chosen and if
  // the Location is not already a real Physical Mobile Device.
  if (!isDeviceLocation && device != '') {
    wptAPI += '&mobile=1&mobileDevice=' + device;
  }

  // Logger.log("wptAPI: " + wptAPI);
  var result = Helper.getPardsedJSONData(wptAPI);
  Logger.log(result);

  if (!result) {
    return;
  }

  var testWPTIdCell =
      testsSheet.getRange(testIndex + 1, testsHeader.testId + 1);

  if (result.statusCode == 400) {
    testWPTIdCell.setBackground('red');
    if (result.statusText == 'Invalid API Key') {
      userApiKeySheet.getRange(2, 2).clearContent();
      requestUserKey(
            'Your API Key is not valid. Please re-enter correct key and ' +
            're-run your test(s)');
    }
    testWPTIdCell.setValue(result.statusText);
    return;
  }

  testWPTIdCell.setValue('submitting test...');
  testWPTIdCell.setBackground('yellow');

  var resultRow = resultsSheet.getLastRow() + 1;

  // Build Perf Budget formulas
  var speedIndexBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.speedIndexBudget, resultsHeader.speedIndex);
  var ttiBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.TTIBudget, resultsHeader.TTI);
  var jsBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.jsBudget, resultsHeader.js);
  var cssBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.cssBudget, resultsHeader.css);
  var fontBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.fontBudget, resultsHeader.font);
  var imagesBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.imagesBudget, resultsHeader.images);
  var videoBudgetFormula = buildPerfBudgetFormula(
    resultRow, resultsHeader.videoBudget, resultsHeader.video);

  // Setup Test Info.
  Helper.writeResults(resultRow, {
    'url': url,
    'label': label,
    'date': Helper.getFormattedDate(new Date())
  });

  if (result.statusCode == 200) {
    testWPTIdCell.setValue(result.data.testId);
    testWPTIdCell.setBackground('LawnGreen');
    Helper.writeResults(resultRow, {
      'wptLink': result.data.userUrl,
      'testId': result.data.testId,
      'jsonUrl': result.data.jsonUrl
    });
  } else {
    Helper.writeResults(resultRow, {'wptLink': ''});
  }
  Helper.writeResults(resultRow, {
    'connection': fullLocation,
    'runs': runs,
    'fvOnly': fvOnly,
    'timeline': timeline,
    'block': block,
    'script': script,
    'status': 'Submitted',
    'speedIndexBudget':speedIndexBudget,
    'TTIBudget': ttiBudget,
    'jsBudget': jsBudget,
    'cssBudget': cssBudget,
    'fontBudget': fontBudget,
    'imagesBudget': imagesBudget,
    'videoBudget': videoBudget,
    'speedIndexBudgetDelta' : speedIndexBudgetFormula,
    'TTIBudgetDetla' : ttiBudgetFormula,
    'jsBudgetDelta' : jsBudgetFormula,
    'cssBudgetDelta' : cssBudgetFormula,
    'fontBudgetDelta' : fontBudgetFormula,
    'imagesBudgetDelta' : imagesBudgetFormula,
    'videoBudgetDelta': videoBudgetFormula
  });
  if (Helper.getSysVar('IS_MANUAL_SUBMIT') ||
      frequency == NO_FREQUENCY)
    Helper.writeResults(resultRow, {'testType': TESTTYPE.MANUAL});
  else
    Helper.writeResults(
        resultRow, {'testType': TESTTYPE.SCHEDULED + ' (' + frequency + ')'});

  // Record analytics as a pageview hit.
  let trackingType = Helper.getSysVar('IS_MANUAL_SUBMIT') ? 'SubmitManualTest' : 'SubmitScheduledTest';
  let hasBudgets = !!(speedIndexBudget || ttiBudget || jsBudget || cssBudget || fontBudget || imagesBudget || videoBudget);
  trackAction(TRACKING_TYPE[trackingType], url, {
    'hasBudgets': hasBudgets, // Boolean
  });

  // Record analytics.
  Helper.fetchUrl(
      GoogleAnalyticsEventURL(activeSId, 'runTest', url));  // Save to analytics
}

/**
 * Cancel selected tests.
 */
function cancelTests() {
  var numTests = testsSheet.getLastRow() - 2;
  var testsData = testsSheet.getDataRange().getValues();

  for (var i = 2; i < numTests + 2; i++) {
    if (testsData[i][testsHeader.run]) {
      var testId = testsData[i][testsHeader.testId];
      Logger.log('Cancelling Test with ID: ' + testId);
      Helper.fetchUrl(
          SERVER_URL + '/cancelTest.php?test=' + testId +
          '&k=' + Helper.retrieveUserKey());
    }
  }
  activeSpreadsheet.toast('cancellation requests sent', 'Status', 10);
  retrieveResults();
}

/**
 * Manually retrieve results from tests.
 */
function retrieveResultsManual() {
  Helper.setSysVar('IS_MANUAL_RETRIEVE', 'true');
  retrieveResults();
}

/**
 * Retrieve results from tests.
 */
function retrieveResults() {
  activeSpreadsheet.toast('Currently retrieving results...', 'Status', -1);

  var numResults = resultsSheet.getLastRow() - 2;
  var resultsData = resultsSheet.getDataRange().getValues();
  var numToRetrieve = 0;
  var sendEMail = false;

  for (var i = 2; i < numResults + 2; i++) {
    var status = resultsData[i][resultsHeader.status];
    if (status && status != STATUSES.RETRIEVED &&
        status != STATUSES.CANCELLED) {
      if (status != STATUSES.ERROR) {
        // Attempt retrieving error data again, but do not count towards an
        // auto-trigger.
        numToRetrieve++;
      }
      if (!sendEMail &&
          Helper.getSysVar('IS_MANUAL_RETRIEVE')) {
        sendEMail = true;
      }
      try {
        var result =
            Helper.getPardsedJSONData(resultsData[i][resultsHeader.jsonUrl]);
        if (result && result.statusText) {
          Helper.writeResults(i + 1, {'status': result.statusText});
          if (result.statusText == 'Test Complete') {
            if (status != STATUSES.ERROR) {
              numToRetrieve--;
            }
            var resultColumn = 1;
            for (var j = 0; j < metrics.length; j++) {
              var metric = metrics[j];
              var value = undefined;
              try {
                value = eval('result.' + metric);
                if (metric.indexOf('breakdown') >= 0 ||
                    metric.indexOf('bytesIn') >= 0)
                  value = value / (1024);
                if (metric.indexOf('bytesIn') >= 0 ||
                    metric.indexOf('css.bytes') >= 0 ||
                    metric.indexOf('font.bytes') >= 0 ||
                    metric.indexOf('js.bytes') >= 0 ||
                    metric.indexOf('image.bytes') >= 0 ||
                    metric.indexOf('video.bytes') >= 0) {
                  value = parseInt(value);
                }
              } catch (e) {
                console.log(e);
              }

              if (value != undefined) {
                resultsSheet
                    .getRange(i + 1, resultColumn + resultsHeader.offset)
                    .setValue(value);
              }

              resultColumn++;
            }
            Helper.writeResults(
                i + 1, {'run': false, 'status': STATUSES.RETRIEVED});

            // Record analytics as a pageview hit.
            let url = resultsData[i][resultsHeader.url];
            let speedIndexBudget = resultsData[i][resultsHeader.speedIndexBudget];
            let ttiBudget = resultsData[i][resultsHeader.TTIBudget];

            let values = {
              'hasBudgets': !!(speedIndexBudget || ttiBudget),
            };
            ['speedIndex', 'TTI', 'js', 'css', 'font', 'images', 'video'].forEach(metric => {
              let budget = resultsData[i][resultsHeader[metric + 'Budget']];
              let metricValue = resultsData[i][resultsHeader[metric]];
              values['underBudget-' + metric] = budget ? metricValue <= budget : null;
              values[metric] = metricValue;
              values[metric + 'Budget'] = budget;
            });
            trackAction(TRACKING_TYPE['Result'], url, values);
          }
        }
      } catch (e) {
        Logger.log('Retrieve result error');
        Logger.log(e);
        Helper.writeResults(i + 1, {'status': STATUSES.ERROR});
      }
    }
  }
  if (numToRetrieve) {
    // Logger.log('numToRetrieve ---> ' + numToRetrieve);
    // Create trigger to retrieve data.
    createRetrieveTrigger();
  } else if (sendEMail) {
    try {
      MailApp.sendEmail(
          Session.getActiveUser().getEmail(),
          '[WPTAutomationTool] Your WPT automated analysis is ready!',
          'Here is your spreadsheet: ' + activeSpreadsheet.getUrl());
    } catch(e) {
      Logger.log('Unable to send out email');
    }
    sendEmail = false;
    activeSpreadsheet.toast('Your results are ready!', 'Status');
  }
  if (!numToRetrieve) {
    deleteRetrieveTrigger();
  }
  initConditionalFormat();
  getLocations();
}

/**
 * Update nextTrigger Dates from Tests.
 */
function updateNextTriggerDates() {
  // Go through tests and update dates.
  var testsData = testsSheet.getDataRange().getValues();
  for (var i = 2; i < testsSheet.getLastRow(); i++) {
    Helper.updateNextTriggerDate(
        i + 1, testsData[i][testsHeader.nextTimestamp]);
  }
}

/**
 * Binded to a in-built timer function and triggers scheduled tests.
 */
function submitScheduledTests() {
  var numAutoTests = 0;
  // Iterate through scheduled tests.
  var testsData = testsSheet.getDataRange().getValues();

  console.log('Total rows: ' + testsSheet.getLastRow());
  for (var i = 2; i < testsSheet.getLastRow(); i++) {
    var nextTimestamp = parseInt(testsData[i][testsHeader.nextTimestamp]);
    var now = Math.floor(Date.now() / 1000);
    // Trigger test if we are past the time.

    if (!isNaN(nextTimestamp) && nextTimestamp <= now) {
      Helper.deleteSysVar('IS_MANUAL_SUBMIT');
      submitIndividualTest(testsData[i], i, SCHEDULED_PRIORITY);
      // Reset timestamp and nextTrigger date to next occurrence.
      var newTimestamp =
          now + getFrequencyMinutes(testsData[i][testsHeader.frequency]) * 60;
      testsSheet.getRange(i + 1, testsHeader.nextTimestamp + 1)
          .setValue(newTimestamp);
      Helper.updateNextTriggerDate(i + 1, newTimestamp);
      numAutoTests++;
    }
  }

  console.log('numAutoTests: ' + numAutoTests);

  // Retrieve results if relevant.
  if (numAutoTests > 0) {
    Helper.deleteSysVar('IS_MANUAL_RETRIEVE');
    retrieveResults();

    // Save to analytics.
    Helper.fetchUrl(
      GoogleAnalyticsEventURL(activeSId, 'amountBatchRunTests', submitted));
  }
}

/**
 * Create a trigger to automatically submit scheduled tests every minutes.
 */
function createSubmitTrigger() {
  // Check if trigger exists and create it if not.
  if (!Helper.getSysVar('TRIGGER_SUBMIT_SCHEDULED')) {
    var thisTrigger = ScriptApp.newTrigger('submitScheduledTests')
                          .timeBased()
                          .everyMinutes(5)
                          .create();
    Helper.setSysVar(
        'TRIGGER_SUBMIT_SCHEDULED', thisTrigger.getUniqueId());
  }
}

/**
 * Create a trigger to automatically retrieve results every minutes.
 */
function createRetrieveTrigger() {
  // Check if trigger exists and create it if not.
  if (!Helper.getSysVar('TRIGGER_RETRIEVE')) {
    var thisTrigger = ScriptApp.newTrigger('retrieveResults')
                          .timeBased()
                          .everyMinutes(10)
                          .create();
    Helper.setSysVar('TRIGGER_RETRIEVE', thisTrigger.getUniqueId());
  }
  activeSpreadsheet.toast(
      'A trigger was created to automatically pull your results every ' +
      'few minutes. Check your results later!', 'Status', -1);
}

/**
 * Delete trigger to automatically retrieve results every minutes.
 */
function deleteRetrieveTrigger() {
  // Delete trigger if it exists.
  if (Helper.getSysVar('TRIGGER_RETRIEVE')) {
    Helper.deleteTrigger(Helper.getSysVar('TRIGGER_RETRIEVE'));
    Helper.deleteSysVar('TRIGGER_RETRIEVE');
  }
  activeSpreadsheet.toast('Your results are ready!', 'Status');
}

/**
 * Set pending tests value to indicate loading process.
 * @param {!object} pendingRange
 */
function setLocationsPending(pendingRange){
   // Clear pending tests data.
  if (pendingRange.getLastRow() > 2) {
    pendingRange.setValue('Loading...');
  }
}

/**
 * Clear dynamically loaded data.
 * @param {!object} pendingRange
 */
function clearLocationsData(pendingRange) {
  // Clear location data.
  if (locationsSheet.getLastRow() > 1) {
    locationsSheet.deleteRows(2, locationsSheet.getLastRow() - 1);
  }
}

/**
 * Return minutes based on the frequency option.
 * @param {string} frequency
 * @return {number}
 */
function getFrequencyMinutes(frequency) {
  if (frequency.trim() === '') return 0;
  var frequencyOptions = frequencySheet.getRange('A2:A').getValues();
  frequencyOptions = frequencyOptions.map(function(element) {
    return element[0];
  });
  var optionIndex = frequencyOptions.indexOf(frequency);
  var minutes = (optionIndex < 0) ?
      0 :
      frequencySheet.getRange(optionIndex + 2, 2).getValue();
  return minutes;
}

/**
 * Get supported locations and pending tests from WPT.
 */
function getLocations() {
  var pendingRange = testsSheet.getRange(
      3, testsHeader.pending + 1, testsSheet.getLastRow() - 2);
  setLocationsPending(pendingRange);
  var locationData = Helper.getPardsedJSONData(WPT_getLocationsURL);
  var locationsInfo = [];
  if (locationData) {
    Object.keys(locationData.data).forEach(function(location) {
      // Create User-friendly name
      var locationTranslation =
          locationData.data[location].labelShort + ' (' + location + ')';
      // Get supported browsers
      var browsers = locationData.data[location].Browsers;
      // Only add locations that support Chrome
      if (browsers.includes('Chrome')) {
        locationsInfo.push([
          locationTranslation, location,
          locationData.data[location].PendingTests.Total, browsers
        ]);
      }
    });
    clearLocationsData(pendingRange);
    var range = locationsSheet.getRange(2, 1, locationsInfo.length, 4);
    range.setValues(locationsInfo);
  }
  // Set validation.
  setLocationValidation();
  // Set pending data.
  pendingRange.setFormula('=VLOOKUP(H3,Locations!$A:$C,3,false)');
}

/**
 * Set location dropdown in Tests sheet.
 */
function setLocationValidation() {
  // Validation.
  var locationInputRange = testsSheet.getRange(
      3, testsHeader.location + 1, testsSheet.getLastRow() - 2);
  var locationDataRange =
      locationsSheet.getRange(2, 1, locationsSheet.getLastRow() - 1);
  // Verify that locations were pulled before setting validation rules
  if(locationDataRange.getValues().length < 1){
    Logger.log('Missing location data when setting location validation.');
    var msg = 'Please enter a valid API key into the User_API_Key tab and' +
        ' then choose initialise in the AutoWebPerf menu. When prompted,' +
        ' please grant AWP access to run properly.';
    SpreadsheetApp.getUi().alert(msg);
  } else {
     var rule = SpreadsheetApp.newDataValidation()
                 .requireValueInRange(locationDataRange)
                 .build();
     locationInputRange.setDataValidation(rule);
  }
}

/**
 * Retrieve location ID from translated location
 * @param {string} translatedLocation
 * @return {string}
 */
function getLocationId(translatedLocation){
   var locationRange =
      locationsSheet.getRange(2, 1, locationsSheet.getLastRow() - 1, 3);
  var locationValues = locationRange.getValues();

  // Search for translated name, and return the location ID WPT needs
  for (var r in locationValues) {
    var rowLocatationName = locationValues[r][0];
    if (rowLocatationName === translatedLocation) {
      return locationValues[r][1];
    }
  }

  // Return a default location if no location is found
  var errMsg = 'Error: no location ID found. Returning default location ID ' +
      defaultTestSettings.locationId;
  Logger.log(errMsg);
  return defaultTestSettings.locationId;
}

/**
 * Tracking with pageview
 * @param {string} type
 * @param {string} testedUrl
 * @param {!object} values
 */
function trackAction(type, testedUrl, values) {
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
  let response = Helper.fetchUrl(GoogleAnalyticsPageViewURL(
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
function GoogleAnalyticsPageViewURL(referral, page, pageTitle, customValues) {
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

/**
 * Tracking.
 * @param {string} spreadsheet
 * @param {string} context
 * @param {string} action
 * @return {string}
 */
function GoogleAnalyticsEventURL(spreadsheet, context, action) {
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

/**
 * Showing comparison dialogue.
 */
function compareTests() {
  var html =
      HtmlService.createHtmlOutputFromFile('CompareDialogue').setHeight(450);
  SpreadsheetApp
      .getUi()  // Or DocumentApp or SlidesApp or FormApp.
      .showModalDialog(html, 'Create Comparison Video');
}

/**
 * Create comparison video/GIF.
 * @param {!object} config
 * @return {!object}
 */
function createComparisonVideo(config) {
  activeSpreadsheet.toast(
      'Preparing video... (This may take 5-10 sec)', 'Status', 5);

  var numTests = resultsSheet.getLastRow() - 2;
  var resultsData = resultsSheet.getDataRange().getValues();
  var compareRow = 5;


  if (config.autoCopy) {
    // Clean up existing compare trix.
    compareSheet.getRange(compareRow, 2, 8, 6).setValue('');
    compareRow = 5;

    for (var i = 2; i < numTests + 2; i++) {
      if (resultsData[i][resultsHeader.run]) {
        Helper.writeData(compareSheet, compareHeader, compareRow, {
          'testId': resultsData[i][resultsHeader.testId],
          'label': resultsData[i][resultsHeader.label],
        });
        compareRow++;
      }
    }

    if (config.repeatView) {
      for (var i = 2; i < numTests + 2; i++) {
        if (resultsData[i][resultsHeader.run]) {
          Helper.writeData(compareSheet, compareHeader, compareRow, {
            'testId': resultsData[i][resultsHeader.testId],
            'label': resultsData[i][resultsHeader.label],
            'repeat': 1,
          });
          compareRow++;
        }
      }
    }
  }

  if (!config.createVideo) return;

  // URLs are stored in the hidden cells in column 5.
  var filmstripUrl = compareSheet.getRange(1, 5).getValue();
  var createVideoUrl = compareSheet.getRange(2, 5).getValue();
  var gifUrl = getGifUrl(createVideoUrl);

  // Show URL dialog.
  var style = '<style>' +
      '* {font-family: "Arial"}' +
      'li {padding: 5px;}' +
      '</style>';
  var body = '<h3>Your video is ready!</h3>' +
      '<ul>' +
      '<li><a target="_blank" id="filmstrip-link" href="' + filmstripUrl +
      '">Filmstrip</a></li>' +
      '<li><a target="_blank" id="preview-video" href="' + createVideoUrl +
      '">Preview video</a></li>' +
      '<li><a target="_blank" id="gif-video" href="' + gifUrl +
      '">Get GIF video</a></li>' +
      '</ul>';
  var html = '<html><body>' + style + body + '</body></html>';
  var htmlOutput =
      HtmlService.createHtmlOutput(html).setHeight(180).setWidth(300);

  if (!gifUrl) {
    body = '<h3>Unable to retrieve GIF Video. Timed out.</h3>';
  }

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Comparison Video');

  return {createVideoUrl: createVideoUrl, gifUrl: gifUrl};
}

/**
 * Create comparison video/GIF.
 * @param {string} createVideoUrl
 * @return {string}
 */
function getGifUrl(createVideoUrl) {
  var count = 0;

  // Will timed out after 10 seconds.
  while (count < 10) {
    var html = Helper.fetchUrl(createVideoUrl).getContentText();
    if (html.search('>Download</a>') > 0) {
      var searchStart = '/video/download.php';
      var searchEnd = '">Download</a>';
      var indexStart = html.search(searchStart);
      var indexEnd = html.search(searchEnd);
      var downloadUrl =
          'http://www.webpagetest.org' + html.substring(indexStart, indexEnd);
      var gifUrl = 'https://ezgif.com/video-to-gif?url=' + downloadUrl;
      return gifUrl;
    }
    Utilities.sleep(1000);
    count++;
  }

  return false;
}

/**
 * Initialize conditional format rules for Result tab.
 */
function initConditionalFormat() {
  var rules = [];
  for (var column = 1; column <= resultsSheet.getMaxColumns(); column++) {
    var columnTitle = resultsSheet.getRange(2, column).getValue();
    var conditions = resultColumnConditions[columnTitle];
    if (conditions && conditions.length > 0) {
      var range =
          resultsSheet.getRange(3, column, resultsSheet.getMaxRows(), 1);
      var maxpoint = conditions[2], midpoint = conditions[1],
          minpoint = conditions[0];
      var maxcolor = '#68bb50', mincolor = '#e06666';
      if (maxpoint < minpoint) {
        maxpoint = conditions[0];
        maxcolor = '#e06666';
        minpoint = conditions[2];
        mincolor = '#68bb50';
      }

      var rule =
          SpreadsheetApp.newConditionalFormatRule()
              .setGradientMaxpointWithValue(
                  maxcolor, SpreadsheetApp.InterpolationType.NUMBER, maxpoint)
              .setGradientMidpointWithValue(
                  '#ffd666', SpreadsheetApp.InterpolationType.NUMBER, midpoint)
              .setGradientMinpointWithValue(
                  mincolor, SpreadsheetApp.InterpolationType.NUMBER, minpoint)
              .setRanges([range])
              .build();
      rules.push(rule);
    }
  }
  resultsSheet.setConditionalFormatRules(rules);
}

/**
 * Build performance budget formulas
 * @param {number} row
 * @param {number} budgetCol
 * @param {number} actualCol
 * @return {string}
 */
function buildPerfBudgetFormula(row, budgetCol, actualCol){
  var budgetColName = resultsSheet.getRange(row, budgetCol + 1).getA1Notation();
  var actualColName = resultsSheet.getRange(row, actualCol + 1).getA1Notation();
  return `=IF(${budgetColName}=0, ${budgetColName}, ` +
      `(${actualColName}-${budgetColName})/${budgetColName})`;
}

/**
 * Reset formulas for Performance Budget Dashboard.
 */
function resetFormulas() {
  formulaMap = {
    'A2': '=if(counta(Results!$B$3:$AV) > 0, QUERY(Results!$B$3:$AV,"SELECT * WHERE C = \'Retrieved\'", 0), "")',
    'AV2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", if( isna(vlookup(F$2:F, Latest_Results!D:D,1, false)), false, true)))',
    'AW2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("L$2:L")/1000))',
    'AX2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("M$2:M")/1000))',
    'AY2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("I$2:I")/1000))',
    'AZ2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "",indirect("K$2:K")/1000))',
    'BA2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("O$2:O")/1000))',
    'BB2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("AH$2:AH")/1000))',
    'BC2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("AI$2:AI")/1000))',
    'BD2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("AJ$2:AJ")/1000))',
    'BE2': '=ArrayFormula(if(isna(vlookup(F$2:F, $F2:F,1, false)), "", indirect("AK$2:AK")/1000))',
  };

  Object.keys(formulaMap).forEach(pos => {
    perfBudgetDashSheet.getRange(pos).setFormula(formulaMap[pos]);
  });
}
