'use strict';

const request = require('request');
const WPTGatherer = require('./gatherers/wpt-gatherer');
const JSONConnector = require('./connectors/json-connector');
const {NodeApiHandler} = require('./helpers/node-helper.js');
const Status = require('./common/status');

const TestType = {
  SINGLE: 'Single',
  RECURRING: 'Recurring',
};

class AutoWebPerf {
  constructor(awpConfig) {
    this.connector = new JSONConnector({
      tests: awpConfig.tests,
      results: awpConfig.results,
    });

    this.wptGatherer = new WPTGatherer({
      apiKey: 'TEST_API', //'A.33b645010f88e6a09879bf0a55a419b9',
    }, new NodeApiHandler());
  }

  run() {
    let tests = this.connector.getTestList();
    let newResults = [];

    tests.map((test) => {
      console.log('Running audit for test item:');
      console.log(test);

      let result = this.wptGatherer.run({
        label: test.label,
        url: test.url,
        firstViewOnly: test.webpagetest.firstViewOnly,
        timeline: test.webpagetest.timeline,
      }, {
        debug: true,
      });

      console.log('Got result...');
      console.log(result);

      newResults.push(result);
    });

    this.connector.appendResultList(newResults);
  }

  retrieve(options) {
    let results = this.connector.getResultList();
    results = results.map(result => {
      if (result.status !== Status.RETRIEVED) {
        return this.wptGatherer.retrieve(result.testId, {debug: true});
      } else {
        return result;
      }
    });

    this.connector.updateResultList(results);
  }

  cancel(testIds) {

  }
}

module.exports = AutoWebPerf;
