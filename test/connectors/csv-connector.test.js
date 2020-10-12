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

const CsvConnector = require('../../src/connectors/csv-connector');
const assert = require('../../src/utils/assert');
const setObject = require('../../src/utils/set-object');
const Status = require('../../src/common/status');

let connectorConfig = {
  testsPath: 'examples/tests.csv',
  resultsPath: 'output/results.csv',
};
let apiHandler = {

};
let envVars = {
  webPageTestApiKey: 'TEST_APIKEY',
  psiApiKey: 'TEST_PSI_KEY',
  gcpProjectId: 'TEST_PROJECTID',
};
let connector;

let fakeTests = [
  {
    "label": "web.dev",
    "url": "https://web.dev",
    "recurring": {
      "frequency": "Daily"
    },
    "psi": {
      "settings": {
        "locale": "en-GB",
        "strategy": "mobile"
      }
    }
  },
  {
    "label": "YouTube",
    "url": "https://youtube.com",
    "psi": {
      "settings": {
        "locale": "en-GB",
        "strategy": "mobile"
      }
    }
  }            
];

let fakeResults = [
  {
    "id": "1599534225837-https://web.dev",
    "type": "Single",
    "status": "Retrieved",
    "label": "web.dev",
    "url": "https://web.dev",
    "createdTimestamp": 1599534225837,
    "modifiedTimestamp": 1599534225837,
    "errors": [],
    "psi": {
      "status": "Retrieved",
      "statusText": "Success",
      "settings": {
        "locale": "en-GB",
        "strategy": "mobile"
      },
      "metadata": {
        "testId": "https://web.dev/",
        "requestedUrl": "https://web.dev/",
        "finalUrl": "https://web.dev/",
        "lighthouseVersion": "6.1.0",
        "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/83.0.4103.93 Safari/537.36",
        "fetchTime": "2020-09-08T03:02:51.198Z"
      },
      "metrics": {
        "lighthouse": {
          "FirstContentfulPaint": 1584,
          "LargestContentfulPaint": 2048,
        }
      },
      "errors": []
    }
  }
];

describe('AppScriptConnector EnvVars tab', () => {
  beforeEach(() => {
    connector = new CsvConnector(connectorConfig, apiHandler, envVars);
    connector.readCsv = (path) => {
      switch(path) {
        case 'examples/tests.csv':
          return fakeTests;
        case 'output/results.csv':
          return fakeResults;
        default:
          return [];
      }
    };
    connector.writeCsv = (path, data) => {
      switch(path) {
        case 'examples/tests.csv':
          fakeTests = data;
          break;
        case 'output/results.csv':
          fakeResults = data;
          break;
      };
    };
  });

  it('returns list of envVars values', async () => {
    let envVars = connector.getEnvVars();
    expect(envVars).toEqual({
      webPageTestApiKey: 'TEST_APIKEY',
      psiApiKey: 'TEST_PSI_KEY',
      gcpProjectId: 'TEST_PROJECTID',
    });
  });

  it('returns list of Tests', async () => {
    let tests = connector.getTestList();
    expect(tests.length).toBe(2);
    expect(tests[0].label).toEqual('web.dev');
    expect(tests[0].url).toEqual('https://web.dev');
  });

  it('updates Tests', async () => {
    let newTests = [{
      "label": "web.dev",
      "url": "https://web.dev",
      "recurring": {
        "frequency": "Daily",
        "nextTriggerTimestamp": 1234
      },
      "psi": {
        "settings": {
          "locale": "en-GB",
          "strategy": "mobile"
        },
      },   
      "csv": {
        index: 0,
      }
    }];

    connector.updateTestList(newTests);
    let tests = connector.getTestList();

    expect(tests.length).toBe(2);
    expect(tests[0].recurring.nextTriggerTimestamp).toEqual(1234);
  });

  it('returns list of Results', async () => {
    let results = connector.getResultList();
    expect(results.length).toBe(1);
    let result = results[0];
    expect(result.label).toEqual('web.dev');
    expect(result.url).toEqual('https://web.dev');
    expect(result.status).toEqual('Retrieved');
    expect(result.psi.settings.strategy).toEqual('mobile');
    expect(result.psi.metrics.lighthouse.LargestContentfulPaint).toEqual(2048);
  });  
  
  it('updates Results', async () => {
    let results = connector.getResultList();
    results[0].csv = {
      index: 0,
    };
    results[0].psi.metrics.lighthouse.LargestContentfulPaint = 1234;
    let newResults = [results[0]];

    connector.updateResultList(newResults);

    let updatedResults = connector.getResultList();
    expect(updatedResults.length).toBe(1);
    expect(updatedResults[0].psi.metrics.lighthouse.LargestContentfulPaint).toEqual(1234);
  });

  it('append Results', async () => {
    let newResults = [
      {
        label: 'newResult',
        url: 'example.com',
        psi: {
          metrics: {
            lighthouse: {
              LargestContentfulPaint: 5678,
            }
          }
        }
      }
    ];
    connector.appendResultList(newResults);

    let updatedResults = connector.getResultList();
    expect(updatedResults.length).toBe(2);
    expect(updatedResults[0].psi.metrics.lighthouse.LargestContentfulPaint).toEqual(1234);
    expect(updatedResults[1].psi.metrics.lighthouse.LargestContentfulPaint).toEqual(5678);

    connector.appendResultList(newResults);
    updatedResults = connector.getResultList();    
    expect(updatedResults.length).toBe(3);
    expect(updatedResults[2].psi.metrics.lighthouse.LargestContentfulPaint).toEqual(5678);
  });
});