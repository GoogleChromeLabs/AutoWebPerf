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
  fetch: () => {}
};
let psiGatherer;

describe('PSIGatherer unit test', () => {
  beforeEach(() => {
    psiGatherer = new PSIGatherer({
      apiKey: 'TEST_APIKEY',
    }, fakeApiHandler, {} /* options */);
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
      url: 'google.com',
      label: 'Google',
      psi: {
        settings: {
          locale: 'en-US',
          strategy: 'mobile'
        }
      },
    };

    // When returning empty response.
    let response, fakeResponse;
    psiGatherer.fakeRunResponse = () => {
      return null;
    };
    response = psiGatherer.run(test, {} /* options */);
    expect(response.status).toEqual(Status.ERROR);
    expect(response.statusText).not.toBe('Success');

    // When returning empty response.
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
    expect(response.metrics.SpeedIndex).toEqual(2000);
  });

  it('follows standardized metric names', async () => {
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
    expect(response.metrics).not.toBe([]);

    // Make sure all metric keys are supported.
    let notSupported = Object.keys(response.metrics).filter(metric => {
      return !MetricKeys.includes(metric);
    })
    expect(notSupported).toEqual([]);
  });
});
