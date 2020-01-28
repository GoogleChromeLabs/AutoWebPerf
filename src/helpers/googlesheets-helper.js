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
   * Return a system variable.
   * @param {string} key
   * @return {string}
   */
  getSysVar: (key) => {
    return documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).getValue();
  },

  /**
   * Set a system variable.
   * @param {string} key
   * @param {string} value
   */
  setSysVar: (key, value) => {
    documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).setValue(value);
  },

  /**
   * Set a system variable.
   * @param {string} key
   */
  deleteSysVar: (key) => {
    documentPropertiesSheet.getRange(SYSVARS[key] + 1, 2).clearContent();
  },

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
   * Return formatted date according to user's calendar setting.
   * @param {!date} dateInput
   * @return {!date}
   */
  getFormattedDate: (dateInput) => {
    return Utilities.formatDate(
        dateInput, this.getSysVar('USER_TIMEZONE'),
        defaultTestSettings.timeFormat);
  },
}

export default {
  GoogleSheetsApiHandler,
  GoogleSheetsHelper,
};
