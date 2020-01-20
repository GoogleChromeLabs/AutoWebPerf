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
    this.debug = awpConfig.debug || false;
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
      let settings = test.webpagetest.settings;
      let wptResponse = this.wptGatherer.run(test, {
        debug: true,
      });
      let nowtime = Date.now();

      console.log('wptResponse.metadata...');
      console.log(wptResponse.metadata);

      newResults.push({
        status: wptResponse.status,
        createdTimestamp: nowtime,
        modifiedTimestamp: nowtime,
        webpagetest: {
          metadata: wptResponse.metadata,
          settings: test.webpagetest.settings,
          metrics: wptResponse.metrics,
        },
      });
    });

    this.connector.appendResultList(newResults);
  }

  retrieve(options) {
    let results = this.connector.getResultList();
    results = results.map(result => {
      if (result.status !== Status.RETRIEVED) {
        let wptResponse = this.wptGatherer.retrieve(
            result.webpagetest.metadata.testId,
            {debug: true});

        return {
          status: wptResponse.status,
          createdTimestamp: result.createdTimestamp,
          modifiedTimestamp: Date.now(),
          webpagetest: {
            metadata: result.webpagetest.metadata,
            settings: result.webpagetest.settings,
            metrics: wptResponse.metrics,
          },
        };
      } else {
        return result;
      }
    });

    this.connector.updateResultList(results);
  }

  cancel(tests) {

  }
}

module.exports = AutoWebPerf;
