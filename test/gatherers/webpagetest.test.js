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

'use strict';

const Status = require('../../src/common/status');
const {MetricKeys} = require('../../src/common/metrics');
const WPTGatherer = require('../../src/gatherers/webpagetest');
const fs = require('fs');

let fakeApiHandler = {
  fetch: () => {},
  get: () => {},
  post: () => {}
};

let wptGatherer;
let wptConfig = {};
let envVars = {};
let fakeResponseData = {
  testId: 'testId',
  jsonUrl: 'jsonUrl',
  xmlUrl: 'xmlUrl',
  userUrl: 'userUrl',
  summaryCSV: 'summaryCSV',
  detailCSV: 'detailCSV',
};

describe('WPTGatherer unit test', () => {
  beforeEach(() => {
    envVars = {
      webPageTestApiKey: 'TEST_APIKEY',
    };
    wptGatherer = new WPTGatherer(wptConfig, envVars, fakeApiHandler,
        {} /* options */);
  });

  it('submits test and get initial response with test ID', async () => {
    let test = {
      selected: 'selected',
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
    envVars = {
      webPageTestApiKey: 'SOME_API_KEY',
    };
    wptGatherer = new WPTGatherer(wptConfig, envVars, fakeApiHandler,
        {} /* options */);

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

    // When API response's statusCode is 400
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 400,
        statusText: 'Some error',
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.errors).toEqual(['Some error']);

    // When body.statusCode is 100
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 100,
          statusText: 'Pending',
          data: fakeResponseData,
        })
      };
    };
    response = wptGatherer.run(test, {} /* options */);

    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.errors).toEqual([]);

    // When body.statusCode is 101
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 101,
          statusText: 'Pending',
          data: fakeResponseData,
        })
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.errors).toEqual([]);

    // When body.statusCode is 400
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 400,
          statusText: 'Some error',
          data: fakeResponseData,
        }),
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.errors).toEqual(['Some error']);

    // When body.statusCode is something else.
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 1234,
          statusText: 'Some error',
          data: fakeResponseData,
        })
      };
    };
    response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.errors).toEqual(['Some error']);
  });

  it('submits test and handles API handler errors', async () => {
    envVars = {
      webPageTestApiKey: 'SOME_API_KEY',
    };
    fakeApiHandler.fetch = () => {
      return  {
        statusCode: 500,
        statusText: 'API fetch error',
      };
    }
    wptGatherer = new WPTGatherer(wptConfig, envVars, fakeApiHandler,
        {} /* options */);

    let test = {
      selected: 'selected',
      url: 'google.com',
      label: 'Google',
      webpagetest: {
        settings: {
          connection: '4G',
        }
      },
    };

    let response = wptGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('API fetch error');
    expect(response.errors).toEqual(['API fetch error']);
  });

  it('retrieves result and get full response', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: Status.SUBMITTED,
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };

    // When body.statusCode is 200
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
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
      status: Status.SUBMITTED,
      webpagetest: {
        metadata: {
          testId: 'id-1234',
          userUrl: 'https://fake.url'
        },
      },
    };
    // When body.statusCode is 100
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 100,
          statusText: 'Pending',
          data: {
            median: {
              firstView: {
                SpeedIndex: 5000,
              }
            }
          }
        })
      }
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.SUBMITTED);
    expect(response.statusText).toEqual('Pending');
    expect(response.metrics).toEqual({});

    // When body.statusCode is 400
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 400,
          statusText: 'Some error',
          data: {}
        })
      }
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual('Some error');
    expect(response.metrics).toEqual({});

    // When body.statusCode is 400 with statusText as "Test not found".
    fakeApiHandler.fetch = () => {
      return  {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 400,
          statusText: 'Test not found',
          data: {}
        })
      }
    };
    response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).toEqual(
        'Test not found. If this happends consistently, try https://fake.url ' +
        'to bring Test back to active.');
    expect(response.metrics).toEqual({});
  });

  it('follows standardized metric names', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: Status.SUBMITTED,
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
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

  it('supports nested metric key such as lighthouse.SpeedIndex', async () => {
    let result = {
      selected: true,
      id: 'id-1234',
      type: 'single',
      url: 'google.com',
      status: Status.SUBMITTED,
      webpagetest: {
        metadata: {
          testId: 'id-1234',
        },
      },
    };
    fakeApiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: fs.readFileSync('./test/fakedata/wpt-retrieve-response.json')
      }
    };
    wptGatherer.metricsMap = {
      'lighthouse.SpeedIndex': 'data.median.firstView.SpeedIndex',
    }

    let response = wptGatherer.retrieve(result, {} /* options */);
    expect(response.metrics.lighthouse.SpeedIndex).not.toBe(undefined);
  });
});
