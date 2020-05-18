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

class PSIGatherer extends Gatherer {
  constructor(config, apiHelper) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.resultApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = config.apiKey;
    this.apiHelper = apiHelper;

    // TODO: Metadata keys should be standardized.
    this.metadataMap = {
      'testId': 'id',
      'requestedUrl': 'lighthouseResult.requestedUrl',
      'finalUrl': 'lighthouseResult.finalUrl',
      'lighthouseVersion': 'lighthouseResult.lighthouseVersion',
      'userAgent': 'lighthouseResult.userAgent',
      'fetchTime': 'lighthouseResult.fetchTime',
    };

    this.metricsMap = {
      'TimeToFirstByte': 'lighthouseResult.audits["time-to-first-byte"].numericValue',
      'FirstContentfulPaint': 'lighthouseResult.audits.metrics.details.items[0].firstContentfulPaint',
      'FirstMeaningfulPaint': 'lighthouseResult.audits.metrics.details.items[0].firstMeaningfulPaint',
      'SpeedIndex': 'lighthouseResult.audits.metrics.details.items[0].speedIndex',
      'TimeToInteractive': 'lighthouseResult.audits.metrics.details.items[0].interactive',
      'FirstCPUIdle': 'lighthouseResult.audits.metrics.details.items[0].firstCPUIdle',
      'FirstInputDelay': 'lighthouseResult.audits.metrics.details.items[0].estimatedInputLatency',
      'TotalBlockingTime': 'lighthouseResult.audits.metrics.details.items[0].totalBlockingTime',
      'HTML': 'lighthouseResult.audits["resource-summary"].details.items[5].size',
      'Javascript': 'lighthouseResult.audits["resource-summary"].details.items[1].size',
      'CSS': 'lighthouseResult.audits["resource-summary"].details.items[4].size',
      'Fonts': 'lighthouseResult.audits["resource-summary"].details.items[2].size',
      'Images': 'lighthouseResult.audits["resource-summary"].details.items[3].size',
      'Videos': 'lighthouseResult.audits["resource-summary"].details.items[7].size',
      'ThirdParty': 'lighthouseResult.audits["resource-summary"].details.items[8].size',
      'UnusedCSS': 'lighthouseResult.audits["unused-css-rules"].details.overallSavingsBytes',
      'WebPImages': 'lighthouseResult.audits["uses-webp-images"].details.overallSavingsBytes',
      'OptimizedImages': 'lighthouseResult.audits["uses-optimized-images"].details.overallSavingsBytes',
      'ResponsiveImages': 'lighthouseResult.audits["uses-responsive-images"].details.overallSavingsBytes',
      'OffscreenImages': 'lighthouseResult.audits["offscreen-images"].details.overallSavingsBytes',
      'DOMElements': 'lighthouseResult.audits["dom-size"].numericValue',
      'Requests': 'lighthouseResult.audits["network-requests"].details.numericValue',
      'Performance': 'lighthouseResult.categories.performance.score',
      'ProgressiveWebApp': 'lighthouseResult.categories.pwa.score',
      'Manifest': 'lighthouseResult.audits["installable-manifest"].score',
      'ServiceWorker': 'lighthouseResult.audits["service-worker"].score',
      'Offline': 'lighthouseResult.audits["works-offline"].score',
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};

    let settings = test.psi.settings;
    let params = {
      'url': encodeURIComponent(test.url),
      'key': this.apiKey,
      'category': ['performance', 'pwa'],
      'locale': settings.locale,
      'strategy': settings.strategy,
    }
    let urlParams = [];
    Object.keys(params).forEach(key => {
      if (Array.isArray(params[key])) {
        params[key].forEach((p) => {
          urlParams.push(key + '=' + p);
        })
      } else {
          urlParams.push(key + '=' + params[key]);
      }
    });

    let url = this.runApiEndpoint + '?' + urlParams.join('&');

    if (options.debug) console.log(url);

    let json = {};
    if (this.apiKey === 'TEST_APIKEY') {
      json = this.fakeRunResponse();

    } else {
      let res = this.apiHelper.fetch(url);
      json = JSON.parse(res);
    }

    let metadata = {}, metrics = new Metrics(), errors = [];
    if (json && json.lighthouseResult) {
      Object.keys(this.metadataMap).forEach(key => {
        try {
          eval(`metadata.${key} = json.${this.metadataMap[key]}`);
        } catch (error) {
          errors.push(error);
        }
      });
      Object.keys(this.metricsMap).forEach(key => {
        // Using eval for the assigning to support non-string and non-numeric
        // value, like Date object.
        try {
          eval(`metrics.set(key, json.${this.metricsMap[key]});`);
        } catch (e) {
          errors.push(e.message);
        }
      });
      // summing up the render blocking resources
      let blockingResourceSize = 0;
      const blockingResources = json.lighthouseResult.audits['render-blocking-resources'];
      if (blockingResources) {
        blockingResources.details.items.forEach((br) => {
          blockingResourceSize += br.totalBytes;
        });
        metrics.set('RenderBlockingResources', blockingResourceSize);
      }

      return {
        status: Status.RETRIEVED,
        statusText: 'Success',
        settings: test.psi.settings,
        metadata: metadata,
        metrics: metrics.toObject() || {},
        errors: errors,
      }
    } else {
      return {
        status: Status.ERROR,
        statusText: 'No Lighthouse result found in PSI response.',
        errors: errors,
      }
    }
  }

  retrieve(resultObj, options) {
    return this.run(resultObj, options);
  }

  fakeRunResponse() {
    return {
      "captchaResult": "CAPTCHA_NOT_NEEDED",
      "kind": "pagespeedonline#result",
      "id": "https://www.thinkwithgoogle.com/",
      "lighthouseResult": {
        "requestedUrl": "https://thinkwithgoogle.com/",
        "finalUrl": "https://www.thinkwithgoogle.com/",
        "lighthouseVersion": "5.6.0",
        "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/78.0.3904.74 Safari/537.36",
        "fetchTime": "2020-01-20T22:38:16.761Z",
        "environment": {
          "networkUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3694.0 Safari/537.36 Chrome-Lighthouse",
          "hostUserAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/78.0.3904.74 Safari/537.36",
          "benchmarkIndex": 642
        },
        "audits": {
          "time-to-first-byte": {
            "numericValue": 967
          },
          "resource-summary": {
            "details": {
              "items": [
                {"size": 5000},
                {"size": 5000},
                {"size": 5000},
                {"size": 5000},
                {"size": 5000},
                {"size": 5000},
                {"size": 5000},
                {"size": 5000}
                ]
            }
          },
          "unused-css-rules": {
            "details": {
              "overallSavingsBytes": 500
            }
          },
          "uses-webp-images": {
            "details": {
              "overallSavingsBytes": 500
            }
          },
          "uses-optimized-images": {
            "details": {
              "overallSavingsBytes": 500
            }
          },
          "uses-responsive-images": {
            "details": {
              "overallSavingsBytes": 500
            }
          },
          "offscreen-images": {
            "details": {
              "overallSavingsBytes": 500
            }
          },
          "dom-size": {
            "numericValue": 200
          },
          "network-requests": {
            "details": {
              "numericValue": 40
            }
          },
          "installable-manifest": {
            "score": 1
          },
          "service-worker": {
            "score": 0
          },
          "works-offline": {
            "score": 0
          },
          "metrics": {
            "id": "metrics",
            "title": "Metrics",
            "description": "Collects all available metrics.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "items": [
                {
                  "observedNavigationStart": 0,
                  "interactive": 1643,
                  "observedFirstVisualChangeTs": 1984383603815,
                  "observedFirstContentfulPaintTs": 1984383611285,
                  "observedLoad": 1158,
                  "observedLastVisualChangeTs": 1984384687815,
                  "observedLargestContentfulPaint": 971,
                  "observedDomContentLoadedTs": 1984382958768,
                  "observedSpeedIndex": 1009,
                  "estimatedInputLatency": 13,
                  "totalBlockingTime": 132,
                  "observedFirstPaint": 971,
                  "observedLastVisualChange": 2048,
                  "firstContentfulPaint": 1040,
                  "observedFirstPaintTs": 1984383611285,
                  "speedIndex": 1208,
                  "observedSpeedIndexTs": 1984383649146,
                  "observedFirstContentfulPaint": 971,
                  "observedNavigationStartTs": 1984382639815,
                  "observedLargestContentfulPaintTs": 1984383611285,
                  "observedFirstVisualChange": 964,
                  "observedLoadTs": 1984383798034,
                  "firstMeaningfulPaint": 1060,
                  "observedTraceEnd": 2217,
                  "observedFirstMeaningfulPaint": 971,
                  "observedTraceEndTs": 1984384856768,
                  "firstCPUIdle": 1445,
                  "observedFirstMeaningfulPaintTs": 1984383611285,
                  "observedDomContentLoaded": 319
                }
              ],
              "type": "debugdata"
            },
            "numericValue": 1642.5
          },
          "render-blocking-resources": {
            "details": {
              "items": [
                {"totalBytes": 200},
                {"totalBytes": 300}
                ]
            }
          }
        },
        "categories": {
          "performance": {
            "score": 0.58
          },
          "pwa": {
            "score": 0.48
          }
        },
      },
      "analysisUTCTimestamp": "2020-01-20T22:38:16.761Z"
    }
  }
}

module.exports = PSIGatherer;
