const request = require('sync-request');

class NodeApiHandler {
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
