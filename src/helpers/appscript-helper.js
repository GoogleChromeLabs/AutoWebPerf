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

const ApiHandler = require('./api-handler');

class AppScriptApiHandler extends ApiHandler {
  fetch(url) {
    return this.get(url);
  }

  get(url) {
    try {
      var response = UrlFetchApp.fetch(url);
      return {
        statusCode: response.getResponseCode(),
        body: response.getContentText(),
      };

    } catch(e) {
      console.error('There was an error while fetching ' + url);
      console.error(e);

      return  {
        statusCode: e.code || 500,
        statusText: e.message,
        error: e
      }
    }
  }

  post(url, postOptions) {
    try {
      let fetchOptions = {
        'method' : 'post'
      };

      if(postOptions.json) {
        fetchOptions.payload = JSON.stringify(postOptions.json);
        fetchOptions.contentType = 'application/json';
      } else
        fetchOptions.payload = postOptions.body;

      let response = UrlFetchApp.fetch(url, fetchOptions);
      return  {
        statusCode: response.getResponseCode(),
        body: response.getContentText()
      }
    } catch(e) {
      console.error('There was an error while fetching ' + url);
      console.error(e);

      return  {
        statusCode: e.code || 500,
        statusText: e.message,
        error: e
      }
    }
  }
}

const TabRole = {
  TESTS: 'tests',
  RESULTS: 'results',
  ENV_VARS: 'envVars',
  SYSTEM: 'system',
  LOCATIONS: 'locations',
};

const SystemVars = {
  RETRIEVE_TRIGGER_ID: 'RETRIEVE_TRIGGER_ID',
  RECURRING_TRIGGER_ID: 'RECURRING_TRIGGER_ID',
  ONEDIT_TRIGGER_ID: 'ONEDIT_TRIGGER_ID',
  LAST_INIT_TIMESTAMP: 'LAST_INIT_TIMESTAMP',
}

const AppScriptHelper = {
  /**
   * Encrypt a string to MD5.
   * @param {string} message
   * @return {string}
   */
  toMD5: (message) => {
    message = message || 'thisisteststring';
    var signature = Utilities.computeDigest(
        Utilities.DigestAlgorithm.MD5, message, Utilities.Charset.US_ASCII);
    var signatureStr = '';
    for (let i = 0; i < signature.length; i++) {
      var byte = signature[i];
      if (byte < 0) byte += 256;
      var byteStr = byte.toString(16);
      // Ensure we have 2 chars in our byte, pad with 0
      if (byteStr.length == 1) byteStr = '0' + byteStr;
      signatureStr += byteStr;
    }
    return signatureStr;
  },

  /**
   * Create a trigger to run when editing a cell.
   */
  createOnEditTrigger: (functionName) => {
    // Check if trigger exists and create it if not.
    var trigger = ScriptApp.newTrigger(functionName)
                          .forSpreadsheet(SpreadsheetApp.getActive())
                          .onEdit()
                          .create();
    return trigger.getUniqueId();
  },

  /**
   * Create a trigger to automatically retrieve results every minutes.
   */
  createTimeBasedTrigger: (functionName, minutes) => {
    // Check if trigger exists and create it if not.
    var trigger = ScriptApp.newTrigger(functionName)
                          .timeBased()
                          .everyMinutes(minutes || 10)
                          .create();
    return trigger.getUniqueId();
  },

  /**
   * Deletes a trigger.
   * @param {string} triggerId The Trigger ID.
   */
  deleteTrigger: (triggerId) => {
    // Loop over all triggers.
    let triggers = ScriptApp.getProjectTriggers();
    for (const i in triggers) {
      // If the current trigger is the correct one, delete it.
      if (triggers[i].getUniqueId === triggerId) {
        ScriptApp.deleteTrigger(triggers[i]);
        break;
      }
    }
  },

  /**
   * Deletes all triggers that match the trigger function name.
   * @param {string} triggerId The Trigger ID.
   */
  deleteTriggerByFunction: (functionName) => {
    // Loop over all triggers.
    let triggers = ScriptApp.getProjectTriggers();
    for (const i in triggers) {
      // If the current trigger is the correct one, delete it.
      if (triggers[i].getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(triggers[i]);
        break;
      }
    }
  },

  /**
   * Deletes all triggers.
   */
  deleteAllTriggers: () => {
    // Loop over all triggers.
    let triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      ScriptApp.deleteTrigger(trigger);
    });
  },

  /**
   * Function to get client email. This will always set clientEmail to anonymous
   * if called from a simple trigger like onOpen(), even if the sheet is authorized
   * @return {string}
   */
  getClientEmail: () => {
    //Set email
    let clientEmail = Session.getActiveUser().getEmail();
    return clientEmail ? AppScriptHelper.toMD5(clientEmail) : 'anonymous';
  },

  /**
   * Get user timezone from calendar and set it as system var.
   */
  getUserTimeZone: () => {
    let userTimeZone;
    try {
      userTimeZone = CalendarApp.getDefaultCalendar().getTimeZone();
    } catch (e) {
      userTimeZone = 'GMT';
    }
    return userTimeZone || 'GMT';
  },

  /**
   * Get active sheet's ID.
   */
  getSpreadsheetId: () => {
    return SpreadsheetApp.getActive().getId();
  },

  /**
   * Return formatted date according to user's calendar setting.
   * @param {!date} dateInput
   * @return {!date}
   */
  getFormattedDate: (dateInput, timeZone, format) => {
    return Utilities.formatDate(dateInput, timeZone,
        format || 'MM/dd/YYYY HH:mm (Z)');
  },
}

module.exports = {
  AppScriptApiHandler,
  AppScriptHelper,
  SystemVars,
  TabRole,
};
