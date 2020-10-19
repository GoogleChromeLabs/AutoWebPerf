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
const PSIGatherer = require('../../src/gatherers/psi');
const setObject = require('../../src/utils/set-object');
const fs = require('fs');

let fakeApiHandler = {
  fetch: () => {},
  getBody: () => {},
  getResponseCode: () => {}
};
let psiGatherer;
let psiConfig = {};
let envVars = {
  psiApiKey: 'TEST_APIKEY',
}

describe('PSIGatherer unit test', () => {
  beforeEach(() => {
    psiGatherer = new PSIGatherer(psiConfig, envVars, fakeApiHandler,
        {} /* options */);
  });

  it('submits test and get full response with test ID', async () => {
    let test = {
      selected: true,
      url: 'google.com',
      label: 'Google',
      psi: {
        settings: {
          locale: 'en-US',
          strategy: 'mobile'
        }
      },
    };
    let response = psiGatherer.run(test, {} /* options */);

    expect(response.status).toEqual(Status.RETRIEVED);
    expect(response.statusText).toEqual('Success');
    expect(response.metadata).not.toBe(null);
    expect(response.metadata.testId).not.toBe(null);
  });

  it('submits test and handles with incomplete or error response', async () => {
    let test = {
      selected: true,
      label: "YT",
      url: "https://www.youtube.com",
      psi: {
        settings: {
          locale: "en-GB",
          strategy: "mobile"
        }
      }
    };

    // Test empty response.
    let response, fakeResponse;
    psiGatherer.fakeRunResponse = () => {
      return null;
    };
    response = psiGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).not.toBe('Success');

    // Test Lighthouse data.
    fakeResponse = {};
    setObject(fakeResponse,
        'lighthouseResult.audits.metrics.details.items[0].speedIndex',
        2000);
    psiGatherer.fakeRunResponse = () => {
      return fakeResponse;
    };
    response = psiGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.RETRIEVED);
    expect(response.statusText).toEqual('Success');
    expect(response.metrics.lighthouse.SpeedIndex).toEqual(2000);

    // Test CrUX data.
    fakeResponse = {};
    setObject(fakeResponse,
        'loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS',
        {
          "percentile": 3610,
          "distributions": [
            {
              "min": 2500,
              "max": 4000,
              "proportion": 0.24342440183268282
            },
            {
              "min": 0,
              "max": 2500,
              "proportion": 0.55002168297603571
            },
            {
              "min": 4000,
              "proportion": 0.2065539151912815
            }
          ],
          "category": "AVERAGE"
        });
    psiGatherer.fakeRunResponse = () => {
      return fakeResponse;
    };
    response = psiGatherer.run(test, {} /* options */);

    expect(response.status).toEqual(Status.RETRIEVED);
    expect(response.statusText).toEqual('Success');
    expect(response.metrics.crux.LargestContentfulPaint).toEqual({
      "category": "AVERAGE",
      "percentile": 3610,
      "good": 0.5500216829760357,
      "ni": 0.24342440183268282,
      "poor": 0.2065539151912815
    });
  });

  it('follows standardized metric names', async () => {
    let test = {
      selected: true,
      label: "YT",
      url: "https://www.youtube.com",
      psi: {
        settings: {
          locale: "en-GB",
          strategy: "mobile"
        }
      }
    };

    let response = psiGatherer.run(test, {} /* options */);
    expect(response.metrics).not.toBe([]);

    // Make sure all metric keys are supported.
    let notSupported = Object.keys(response.metrics).filter(metric => {
      return !MetricKeys.includes(metric);
    })
    expect(notSupported).toEqual([]);
  });

  it('parses bundle size details', async () => {
    let response, fakeResponse = {};

    let test = {
      selected: true,
      label: "YT",
      url: "https://www.youtube.com",
      psi: {
        settings: {
          locale: "en-GB",
          strategy: "mobile"
        }
      }
    };

    setObject(fakeResponse,
      'lighthouseResult.audits.render-blocking-resources.details.items[0].totalBytes',
      100);
    setObject(fakeResponse,
      'lighthouseResult.audits.render-blocking-resources.details.items[1].totalBytes',
      250);  
    psiGatherer.fakeRunResponse = () => {
        return fakeResponse;
      };
    response = psiGatherer.run(test, {} /* options */);
    expect(response.metrics.RenderBlockingResources).toEqual(350);

    // Handles when the render-blocking-resources is not defined.
    fakeResponse = {};
    setObject(fakeResponse, 'lighthouseResult.audits', {});
    response = psiGatherer.run(test, {} /* options */);
    expect(response.metrics).toEqual({});
    expect(response.metrics.RenderBlockingResources).toEqual(undefined);
  });
});
