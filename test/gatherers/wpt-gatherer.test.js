/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Status = require('../../src/common/status');
const {MetricKeys} = require('../../src/common/metrics');
const WPTGatherer = require('../../src/gatherers/wpt-gatherer');
const fs = require('fs');

let fakeApiHandler = {
  fetch: () => {}
};

let wptGatherer;

describe('WPTGatherer unit test', () => {
  beforeEach(() => {
    wptGatherer = new WPTGatherer({
      apiKey: 'TEST_APIKEY',
    }, fakeApiHandler, {} /* options */);
  });

  it('submits test and get initial response with test ID', async () => {
    let test = {
      selected: true,
      url: 'google.com',
      label: 'Google',
      webpagetest: {
        settings: {
          connection: '4G',
        }
      },
    };
    let response = wptGatherer.run(test, {} /* options */);

    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Ok');
    expect(response.metadata).not.toBe(null);
    expect(response.metadata.testId).not.toBe(null);
    expect(response.settings).not.toBe(null);
    expect(response.errors).toEqual([]);
  });

  it('submits test and handles status codes', async () => {
    let test = {
      selected: true,
      url: 'google.com',
      label: 'Google',
      webpagetest: {
        settings: {
          connection: '4G',
        }
      },
    };

    let response;

    // When statusCode is 100
    wptGatherer.fakeRunResponse = () => {
      return {
        statusCode: 100,
        statusText: 'Pending',
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.errors).toEqual([]);

    // When statusCode is 101
    wptGatherer.fakeRunResponse = () => {
      return {
        statusCode: 101,
        statusText: 'Pending',
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.errors).toEqual([]);

    // When statusCode is 400
    wptGatherer.fakeRunResponse = () => {
      return {
        statusCode: 400,
        statusText: 'Some error',
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.errors).toEqual([]);

    // When statusCode is something else.
    wptGatherer.fakeRunResponse = () => {
      return {
        statusCode: 1234,
        statusText: 'Some error',
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.errors).toEqual([]);
  });

  it('retrieves result and get full response', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: 'submitted',
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    // When statusCode is 100
    fakeApiHandler.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };
    let response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.RETRIEVED);
    expect(response.statusText).toEqual('Success');
    expect(response.metrics.SpeedIndex).toEqual(702);
    expect(response.errors).toEqual([]);
  });

  it('retrieves result and handles status codes', async () => {
    let response;
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: 'submitted',
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    // When statusCode is 100
    fakeApiHandler.fetch = () => {
      return JSON.stringify({
        statusCode: 100,
        statusText: 'Pending',
        data: {
          median: {
            firstView: {
              SpeedIndex: 5000,
            }
          }
        }
      });
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.metrics).toEqual({});

    // When statusCode is 400
    fakeApiHandler.fetch = () => {
      return JSON.stringify({
        statusCode: 400,
        statusText: 'Some error',
        data: {}
      });
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.metrics).toEqual({});

    // When statusCode is 400 with statusText as "Test not found".
    fakeApiHandler.fetch = () => {
      return JSON.stringify({
        statusCode: 400,
        statusText: 'Test not found',
        data: {}
      });
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Test not found');
    expect(response.metrics).toEqual({});
  });

  it('follows standardized metric names', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: 'submitted',
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    fakeApiHandler.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };
    let response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.metrics).not.toBe([]);

    // Get all metric keys from the response.
    // TODO: Cover webpagetest.lighthouse.metrics.*
    let metrics = Object.keys(response.metrics);

    // Make sure all metric keys are supported.
    let notSupported = metrics.filter(metric => {
      let parts = metric.split('.');
      if (parts.length > 1) metric = parts[parts.length -1];
      return metric !== 'lighthouse' && !MetricKeys.includes(metric);
    })
    expect(notSupported).toEqual([]);
  });

  it('throws error when dealing with unsupported metric names', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: 'submitted',
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    fakeApiHandler.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };
    wptGatherer.metricsMap = {
      'NotSupportedMetric': 'data.median.firstView.TTFB',
    }

    let response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.errors).toEqual(
        ['Metric key "NotSupportedMetric" is not supported.']);
  });

  it('supports nested metric key such as lighthouse.SpeedIndex', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: 'submitted',
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    fakeApiHandler.fetch = () => {
      return fs.readFileSync('./test/fakedata/wpt-retrieve-response.json');
    };
    wptGatherer.metricsMap = {
      'lighthouse.SpeedIndex': 'data.median.firstView.SpeedIndex',
    }

    let response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.metrics.lighthouse.SpeedIndex).not.toBe(undefined);
  });
});
