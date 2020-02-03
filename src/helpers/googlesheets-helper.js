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
}

const GoogleSheetsHelper = {
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
    for (i = 0; i < signature.length; i++) {
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
   * Create a trigger to automatically retrieve results every minutes.
   */
  createTrigger: (functionName, minutes) => {
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
    var allTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < allTriggers.length; i++) {
      // If the current trigger is the correct one, delete it.
      if (allTriggers[i].getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(allTriggers[i]);
        break;
      }
    }
  },

  /**
   * Deletes all triggers.
   * @param {string} triggerId The Trigger ID.
   */
  deleteAllTriggers: (triggerId) => {
    // Loop over all triggers.
    var allTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < allTriggers.length; i++) {
      ScriptApp.deleteTrigger(allTriggers[i]);
    }
  },

  /**
   * Function to get client email. This will always set clientEmail to anonymous
   * if called from a simple trigger like onOpen(), even if the sheet is authorized
   * @return {string}
   */
  getClientEmail: () => {
    //Set email
    let clientEmail = Session.getActiveUser().getEmail();
    return clientEmail ? GoogleSheetsHelper.toMD5(clientEmail) : 'anonymous';
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
   * Return formatted date according to user's calendar setting.
   * @param {!date} dateInput
   * @return {!date}
   */
  getFormattedDate: (dateInput, timeZone, format) => {
    return Utilities.formatDate(dateInput, timeZone,
        format || 'MM/dd/YY HH:mm');
  },
}

export default {
  GoogleSheetsApiHandler,
  GoogleSheetsHelper,
};
