const request = require('sync-request');

class NodeApiHandler {
  fetch(url) {
    return request('GET', url).getBody();
  }
}

module.exports = {
  NodeApiHandler,
};
