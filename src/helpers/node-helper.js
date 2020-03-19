const request = require('sync-request');
const ApiHandler = require('./api-handler');

class NodeApiHandler extends ApiHandler {
  fetch(url) {
    return request('GET', url).getBody().toString();
  }
}

class NodeOutputHandler {
  constructor(isDebug) {
    this.isDebug = isDebug || false;
  }

  log(str) {
    console.log(str);
  }

  debug(str) {
    if (this.isDebug) console.error(str);
  }
}

module.exports = {
  NodeApiHandler,
  NodeOutputHandler,
};
