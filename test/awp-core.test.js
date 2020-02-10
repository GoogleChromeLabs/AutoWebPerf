/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const AutoWebPerf = require('../src/awp-core');
const Connector = require('../src/connectors/connector');
const Gatherer = require('../src/gatherers/gatherer');
const Extension = require('../src/extensions/extension');
const Status = require('../src/common/status');

let generateFakeTests = function(amount, options) {
  options = options || {};
  let tests = [];
  let count = 1;
  while (count <= amount) {
    let test = {
      id: 'test-' + count,
      url: 'url-' + count,
      label: 'label-' + count,
      fake: {
        settings: {
          connection: '4G',
        },
      },
    };
    if (options.recurring) {
      test.recurring = {
        frequency: options.recurring.frequency,
      };
    }

    tests.push(test);
    count ++;
  }
  return tests;
}

let generateFakeResults = function(amount, options) {
  options = options || {};
  let results = [];
  let offset = options.idOffset || 0;
  let count = 1;
  while (count <= amount) {
    let result = {
      id: 'result-' + (count + offset),
      type: 'Single',
      url: 'url-' + count,
      label: 'label-' + count,
      status: Status.SUBMITTED,
      fake: {
        status: Status.SUBMITTED,
        metrics: undefined,
        metadata: undefined,
        settings: {
          connection: '4G',
        },
      },
    };

    if (options.retrieved) {
      result.status = Status.RETRIEVED;
      result.fake.status = Status.RETRIEVED;
      result.fake.metrics = {
        FCP: 500,
      };
    }

    results.push(result);
    count ++;
  }
  return results;
}

let cleanFakeResults = function(results) {
  let count = 1;
  return results.map(result => {
    result.id = 'result-' + count;
    delete result.createdTimestamp;
    delete result.modifiedTimestamp;
    count++;
  });
}

class FakeConnector extends Connector {
  constructor(config) {
    super();
    this.tests = [];
    this.results = [];
  }
  getConfig() {
    return {
      apiKeys: {
        'fake': 'TEST_APIKEY'
      }
    };
  }
  getTestList() {
    return this.tests;
  }
  updateTestList(newTests) {
    this.tests.forEach(test => {
      return newTests.filter(x => test.id === x.id)[0];
    });
  }
  getResultList() {
    return this.results;
  }
  appendResultList(newResults) {
    this.results = this.results.concat(newResults);
  }
  updateResultList(newResults) {
    this.results.forEach(result => {
      return newResults.filter(x => result.id === x.id)[0];
    });
  }
}

class FakeGatherer extends Gatherer {
  run(test) {
    let result = test;
    result.id = 'result-' + test.id;
    result.type = 'single';
    result.status = Status.SUBMITTED;
    return {
      status: Status.SUBMITTED,
      settings: result.fake.settings,
    };
  }
  retrieve(result) {
    result.fake.status = Status.RETRIEVED;
    return {
      status: Status.RETRIEVED,
      metadata: result.fake.metadata,
      settings: result.fake.settings,
      metrics: {
        FCP: 500,
      },
    };
  }
}

class FakeExtension extends Extension {
  beforeRun(test) {}
  afterRun(test, result) {}
  beforeAllRuns(tests, results) {}
  afterAllRuns(tests, results) {}
  beforeRetrieve(result) {}
  afterRetrieve(result) {}
  beforeAllRetrieves(results) {}
  afterAllRetrieves(results) {}
}

const fakeApiHandler = function(url) {
  return {};
}

describe('AutoWebPerf with fake modules', () => {
  let awp;

  beforeEach(() => {
    awp = new AutoWebPerf({
      connector: 'fake',
      helper: 'fake',
      dataSources: ['fake'],
    });
    awp.connector = new FakeConnector();
    awp.apiHandler = fakeApiHandler;
    awp.gatherers = {
      fake: new FakeGatherer(),
    }
    awp.extensions = {
      fake: new FakeExtension(),
    };

    // Mock functions
    ['beforeRun', 'afterRun', 'beforeRetrieve', 'afterRetrieve',
        'beforeAllRuns', 'afterAllRuns', 'beforeAllRetrieves',
        'afterAllRetrieves'].forEach(funcName => {
          awp.extensions.fake[funcName] = jest.fn();
        });
  });

  it('initializes normally.', async () => {
    expect(awp).not.toBe(null);
  });

  it('runs through a list of tests and gets initial results.', async () => {
    awp.connector.tests = generateFakeTests(10);
    awp.run();

    cleanFakeResults(awp.connector.results);
    let expectedResults = generateFakeResults(10);
    expect(awp.getResults()).toEqual(expectedResults);

    awp.run();

    cleanFakeResults(awp.connector.results);
    expectedResults = expectedResults.concat(generateFakeResults(10, {
      idOffset: 10,
    }));
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('runs recurring through a list of tests and gets initial results.', async () => {
    awp.connector.tests = generateFakeTests(10);
    let test = awp.connector.tests[0];
    test.recurring = {
      frequency: 'daily',
    }
    let nowTime = Date.now();
    awp.recurring({activateOnly: true});
    expect(test.recurring.nextTrigger).not.toBe(null);
    expect(test.recurring.nextTriggerTimestamp).not.toBe(null);

    test.recurring.nextTriggerTimestamp = nowTime;
    awp.recurring();
    cleanFakeResults(awp.connector.results);

    let expectedResults = generateFakeResults(1);
    expectedResults[0].type = 'Recurring';
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('retrieves all non-complete results.', async () => {
    awp.connector.tests = generateFakeTests(10);
    awp.run();
    awp.retrieve();

    cleanFakeResults(awp.connector.results);
    let expectedResults = generateFakeResults(10, {retrieved: true});
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('runs and retrieves all results with partial updates.', async () => {
    let expectedResults;
    awp.connector.tests = generateFakeTests(95);
    awp.batchUpdate = 10;

    expectedResults = generateFakeResults(95);
    awp.run();
    cleanFakeResults(awp.connector.results);
    expect(awp.getResults()).toEqual(expectedResults);

    awp.retrieve();
    cleanFakeResults(awp.connector.results);
    expectedResults = generateFakeResults(95, {retrieved: true});
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('runs and retrieves all results with partial updates.', async () => {
    let expectedResults;
    awp.connector.tests = generateFakeTests(22);
    awp.batchUpdate = 5;

    expectedResults = generateFakeResults(22);
    awp.run();
    cleanFakeResults(awp.connector.results);
    expect(awp.getResults()).toEqual(expectedResults);

    awp.retrieve();
    cleanFakeResults(awp.connector.results);
    expectedResults = generateFakeResults(22, {retrieved: true});
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('runs and retrieves all recurring results with partial updates.', async () => {
    awp.connector.tests = generateFakeTests(22);
    awp.batchUpdate = 5;
    let nowTime = Date.now();
    awp.connector.tests.forEach(test => {
      test.recurring = {
        frequency: 'daily',
      }
    });

    awp.recurring({activateOnly: true});
    awp.connector.tests.forEach(test => {
      test.recurring .nextTriggerTimestamp = nowTime;
    });
    awp.recurring();
    cleanFakeResults(awp.connector.results);

    let expectedResults = generateFakeResults(22);
    expectedResults.forEach(result => {result.type = 'Recurring'});
    expect(awp.getResults()).toEqual(expectedResults);
  });

  it('runs through a list of tests and executes extensions.', async () => {
    awp.connector.tests = generateFakeTests(10);
    awp.run();
    expect(awp.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(awp.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('runs activateOnly recurring and executes extensions.', async () => {
    awp.connector.tests = generateFakeTests(10, {
      recurring: {frequency: 'daily'},
    });

    awp.recurring({activateOnly: true});
    expect(awp.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(awp.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('runs recurring through a list of tests and executes extensions.', async () => {
    awp.connector.tests = generateFakeTests(10, {
      recurring: {frequency: 'daily'},
    });

    awp.recurring();
    expect(awp.extensions.fake.beforeAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.afterAllRuns.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.beforeRun.mock.calls.length).toBe(10);
    expect(awp.extensions.fake.afterRun.mock.calls.length).toBe(10);
  });

  it('retrieves a list of results and executes extensions.', async () => {
    awp.connector.tests = generateFakeTests(10);
    awp.run();
    awp.retrieve();
    expect(awp.extensions.fake.beforeAllRetrieves.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.afterAllRetrieves.mock.calls.length).toBe(1);
    expect(awp.extensions.fake.beforeRetrieve.mock.calls.length).toBe(10);
    expect(awp.extensions.fake.afterRetrieve.mock.calls.length).toBe(10);
  });
});
