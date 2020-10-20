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

const assert = require('../utils/assert');
const Status = require('../common/status');
const {Metrics} = require('../common/metrics');
const Gatherer = require('./gatherer');

class CrUXAPIGatherer extends Gatherer {
  constructor(config, envVars, apiHandler) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHandler is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.runApiEndpoint = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
    this.apiKey = envVars['CRUX_APIKEY'] || envVars['cruxApiKey'];
    this.apiHandler = apiHandler;

    // TODO: Metadata keys should be standardized.
    this.metadataMap = {
      'testId': 'id'
    };

    this.metricsMap = {
      'LargestContentfulPaint': 'processedCrUXMetrics.lcp',
      'FirstInputDelay': 'processedCrUXMetrics.fid',
      'CumulativeLayoutShift': 'processedCrUXMetrics.cls',
      'FirstContentfulPaint': 'processedCrUXMetrics .fcp',
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};

    let url = this.runApiEndpoint + '?key=' + this.apiKey;

    if (options.debug) console.log(test);

    let cruxConfig = test.cruxapi || {};
    let settings = cruxConfig.settings || {};

    let apiJsonOutput = {},
      statusText = "",
      status = "",
      metrics = new Metrics(),
      errors = [];

    if (this.apiKey === 'TEST_APIKEY') {
      apiJsonOutput = this.fakeRunResponse();

    } else {
      let apiOptions = {
        json : {}
      };

      assert(test.url, 'Parameter URL is missing.');
      settings.urlType = settings.urlType || 'Origin';
      if (settings.urlType === 'Page') {
        apiOptions.json.url = test.url;
      } else {
        apiOptions.json.origin = test.url;
      }

      if(settings.formFactor && settings.formFactor !== 'ALL')
        apiOptions.json.formFactor = settings.formFactor;

      if (options.debug) {
        console.log(`Sending POST request to ${url} with parameters:`);
        console.log(JSON.stringify(apiOptions, null, 2));
      }

      let response = this.apiHandler.post(url, apiOptions);
      if (response.statusCode === 200) {
        apiJsonOutput = JSON.parse(response.body);

      } else {
        let errorMsg = response.statusText;

        try {
          let errorBody = JSON.parse(response.error.body);
          errorMsg = `${errorBody.error.message} (${test.url})`;
        } catch (e) {
          // do nothing.
        }
        errors.push(errorMsg);
      }
    }

    if(apiJsonOutput && apiJsonOutput.record && apiJsonOutput.record.metrics) {
      this.preprocessData(apiJsonOutput);
      let value;
      Object.keys(this.metricsMap).forEach(key => {
        // Using eval for the assigning to support non-string and non-numeric
        // value, like Date object.
        try {
          eval(`value = apiJsonOutput.${this.metricsMap[key]};`);
          metrics.set(key, value);

        } catch (e) {
          errors.push(`Unable to assign apiJsonOutput.${this.metricsMap[key]} to ` +
              `metrics: ${e.message}`);
        }
      });

      status = Status.RETRIEVED;
      statusText = 'Success';

    } else {
      status = Status.ERROR;
      statusText = 'No result found in CrUX API response';
    }

    return {
      status: status,
      statusText: statusText,
      metrics: metrics.toObject() || {},
      settings: cruxConfig.settings,
      errors: errors,
    }
  }

  retrieve(resultObj, options) {
    return this.run(resultObj, options);
  }

  async runBatch(tests, options) {
    return null;
  }

  preprocessData(json) {
    let processedCrUXMetrics = {};
    let metrics = json.record.metrics;
    let metricsToProcess = {
      lcp: metrics.largest_contentful_paint,
      cls: metrics.cumulative_layout_shift,
      fid: metrics.first_input_delay,
      fcp: metrics.first_contentful_paint
    };

    for (let metric in metricsToProcess) {
      let metricObj = metricsToProcess[metric];
      if (metricObj) {
        processedCrUXMetrics[metric] = {
          p75: metricObj.percentiles.p75,
          good: metricObj.histogram[0].density,
          ni: metricObj.histogram[1].density,
          poor: metricObj.histogram[2].density,
        }
      }
    }
    json.processedCrUXMetrics = processedCrUXMetrics;
  }

  fakeRunResponse() {
    return {
      "record": {
        "key": {
          "formFactor": "PHONE",
          "url": "[FAKE_RESPONSE] https://web.dev/"
        },
        "metrics": {
          "cumulative_layout_shift": {
            "histogram": [
              {
                "start": "0.00",
                "end": "0.10",
                "density": 0.82508108108108091
              },
              {
                "start": "0.10",
                "end": "0.25",
                "density": 0.081081081081081058
              },
              {
                "start": "0.25",
                "density": 0.093837837837837737
              }
            ],
            "percentiles": {
              "p75": "0.05"
            }
          },
          "first_contentful_paint": {
            "histogram": [
              {
                "start": 0,
                "end": 1000,
                "density": 0.22853130016051693
              },
              {
                "start": 1000,
                "end": 3000,
                "density": 0.63984751203853252
              },
              {
                "start": 3000,
                "density": 0.13162118780096693
              }
            ],
            "percentiles": {
              "p75": 2231
            }
          },
          "first_input_delay": {
            "histogram": [
              {
                "start": 0,
                "end": 100,
                "density": 0.93853327681221
              },
              {
                "start": 100,
                "end": 300,
                "density": 0.040907164052564705
              },
              {
                "start": 300,
                "density": 0.020559559135226845
              }
            ],
            "percentiles": {
              "p75": 23
            }
          },
          "largest_contentful_paint": {
            "histogram": [
              {
                "start": 0,
                "end": 2500,
                "density": 0.78492569002123935
              },
              {
                "start": 2500,
                "end": 4000,
                "density": 0.13673036093418398
              },
              {
                "start": 4000,
                "density": 0.078343949044587052
              }
            ],
            "percentiles": {
              "p75": 2337
            }
          }
        }
      },
      "urlNormalizationDetails": {
        "originalUrl": "https://web.dev",
        "normalizedUrl": "https://web.dev/"
      }
    }
  }
}

module.exports = CrUXAPIGatherer;
