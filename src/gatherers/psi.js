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
  constructor(config, envVars, apiHelper) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHelper is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.resultApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = envVars['psiApiKey'];
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
      'crux.LargestContentfulPaint': 'processedLoadingExperience.lcp',
      'crux.FirstInputDelay': 'processedLoadingExperience.fid',
      'crux.FirstContentfulPaint': 'processedLoadingExperience.fcp',
      'crux.CumulativeLayoutShift': 'processedLoadingExperience.cls',
      'lighthouse.FirstContentfulPaint': 'lighthouseResult.audits.metrics.details.items[0].firstContentfulPaint',
      'lighthouse.FirstMeaningfulPaint': 'lighthouseResult.audits.metrics.details.items[0].firstMeaningfulPaint',
      'lighthouse.LargestContentfulPaint': 'lighthouseResult.audits["largest-contentful-paint"].numericValue',
      'lighthouse.SpeedIndex': 'lighthouseResult.audits.metrics.details.items[0].speedIndex',
      'lighthouse.TimeToInteractive': 'lighthouseResult.audits.metrics.details.items[0].interactive',
      'lighthouse.FirstCPUIdle': 'lighthouseResult.audits.metrics.details.items[0].firstCPUIdle',
      'lighthouse.FirstInputDelay': 'lighthouseResult.audits.metrics.details.items[0].estimatedInputLatency',
      'lighthouse.TotalBlockingTime': 'lighthouseResult.audits.metrics.details.items[0].totalBlockingTime',
      'lighthouse.CumulativeLayoutShift': 'lighthouseResult.audits.metrics.details.items[0].cumulativeLayoutShift',
      'lighthouse.TotalSize': 'lighthouseResult.audits["total-byte-weight"].numericValue',
      'lighthouse.HTML': 'processedRessourceSummaryItems.HTMLSize',
      'lighthouse.Javascript': 'processedRessourceSummaryItems.JavascriptSize',
      'lighthouse.CSS': 'processedRessourceSummaryItems.CSSSize',
      'lighthouse.Fonts': 'processedRessourceSummaryItems.FontsSize',
      'lighthouse.Images': 'processedRessourceSummaryItems.ImagesSize',
      'lighthouse.Medias': 'processedRessourceSummaryItems.MediasSize',
      'lighthouse.ThirdParty': 'processedRessourceSummaryItems.ThirdPartySize',
      'lighthouse.UnusedCSS': 'lighthouseResult.audits["unused-css-rules"].details.overallSavingsBytes',
      'lighthouse.WebPImages': 'lighthouseResult.audits["uses-webp-images"].details.overallSavingsBytes',
      'lighthouse.OptimizedImages': 'lighthouseResult.audits["uses-optimized-images"].details.overallSavingsBytes',
      'lighthouse.ResponsiveImages': 'lighthouseResult.audits["uses-responsive-images"].details.overallSavingsBytes',
      'lighthouse.OffscreenImages': 'lighthouseResult.audits["offscreen-images"].details.overallSavingsBytes',
      'lighthouse.DOMElements': 'lighthouseResult.audits["dom-size"].numericValue',
      'lighthouse.Requests': 'lighthouseResult.audits["network-requests"].details.numericValue',
      'lighthouse.Performance': 'lighthouseResult.categories.performance.score',
      'lighthouse.ProgressiveWebApp': 'lighthouseResult.categories.pwa.score',
      'lighthouse.Manifest': 'lighthouseResult.audits["installable-manifest"].score',
      'lighthouse.ServiceWorker': 'lighthouseResult.audits["service-worker"].score',
      'lighthouse.Offline': 'lighthouseResult.audits["works-offline"].score',
      'lighthouse.Accessibility': 'lighthouseResult.categories.accessibility.score',
      'lighthouse.SEO': 'lighthouseResult.categories.seo.score',
      'lighthouse.BestPractices': 'lighthouseResult.categories["best-practices"].score',
    };

    let bytesToKb = (x) => Math.round(x / 1000);
    this.metricsConversion = {
      'lighthouse.TotalSize': bytesToKb,
      'lighthouse.HTML': bytesToKb,
      'lighthouse.Javascript': bytesToKb,
      'lighthouse.CSS': bytesToKb,
      'lighthouse.Fonts': bytesToKb,
      'lighthouse.Images': bytesToKb,
      'lighthouse.Medias': bytesToKb,
      'lighthouse.ThirdParty': bytesToKb,
      'lighthouse.UnusedCSS': bytesToKb,
      'lighthouse.WebPImages': bytesToKb,
      'lighthouse.OptimizedImages': bytesToKb,
      'lighthouse.ResponsiveImages': bytesToKb,
      'lighthouse.OffscreenImages': bytesToKb,
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};
    let settings = test.psi.settings;
    let params = {
      'url': encodeURIComponent(test.url),
      'key': this.apiKey,
      'category': ['performance', 'pwa', 'accessibility', 'seo', 'best-practices'],
      'locale': settings.locale || 'en-us',
      'strategy': settings.strategy || 'mobile',
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

    let json = {}, response;
    if (this.apiKey === 'TEST_APIKEY') {
      // For testing purpose.
      json = this.fakeRunResponse();

    } else {
      try {
        response = this.apiHelper.fetch(url);
      } catch (e) {
        return {
          status: Status.ERROR,
          statusText: e.message,
          settings: settings,
          errors: [e.message],
        };
      }

      if(response.statusCode >= 400) {
        return {
          status: Status.ERROR,
          statusText: response.statusText,
          settings: settings,
          errors: [response.statusText],
        };
      }

      json = JSON.parse(response.body);
    }

    let metadata = {},
      metrics = new Metrics(),
      errors = [];

    if (json) {
      if (json.loadingExperience) {
        this.preprocessData(json, 'crux');
      }

      if (json.lighthouseResult) {
        if (json.lighthouseResult.audits['resource-summary']) {
          this.preprocessData(json, 'lighthouseResourceSummary');
        }
        // summing up the render blocking resources
        let blockingResourceSize = 0;
        const blockingResources = json.lighthouseResult.audits['render-blocking-resources'];
        if (blockingResources) {
          blockingResources.details.items.forEach((br) => {
            blockingResourceSize += br.totalBytes;
          });
          metrics.set('RenderBlockingResources', blockingResourceSize);
        }
      }

      Object.keys(this.metadataMap).forEach(key => {
        try {
          eval(`metadata.${key} = json.${this.metadataMap[key]}`);
        } catch (e) {
          errors.push(`Unable to assign json.${this.metadataMap[key]} to ` +
            `metadata: ${e.message}`);
        }
      });

      let value;
      Object.keys(this.metricsMap).forEach(key => {
        // Using eval for the assigning to support non-string and non-numeric
        // value, like Date object.
        try {
          eval(`value = json.${this.metricsMap[key]};`);
          if (this.metricsConversion[key]) {
            value = this.metricsConversion[key](value);
          }
          metrics.set(key, value);

        } catch (e) {
          errors.push(`Unable to assign json.${this.metricsMap[key]} to ` +
              `metrics: ${e.message}`);
        }
      });
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
        statusText: 'No result found in PSI response.',
        errors: errors,
      }
    }
  }

  retrieve(resultObj, options) {
    return this.run(resultObj, options);
  }

  async runBatch(tests, options) {
    return null;
  }

  preprocessData(json, dataSource) {
    if (dataSource === 'crux') {
      let processedLoadingExperience = {};
      let expMetrics = json.loadingExperience.metrics;
      let expMetricsToProcess = {
        lcp: expMetrics.LARGEST_CONTENTFUL_PAINT_MS,
        fid: expMetrics.FIRST_INPUT_DELAY_MS,
        fcp: expMetrics.FIRST_CONTENTFUL_PAINT_MS,
        cls: expMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE
      };

      for (let metric in expMetricsToProcess) {
        let metricObj = expMetricsToProcess[metric];
        if (metricObj) {
          // Sort metrics by good / ni / fast buckets and populate processed data.
          metricObj.distributions.sort((a, b) => (a.min > b.min) ? 1 : -1);
          processedLoadingExperience[metric] = {
            category: metricObj.category,
            percentile: metricObj.percentile,
            good: metricObj.distributions[0].proportion,
            ni: metricObj.distributions[1].proportion,
            poor: metricObj.distributions[2].proportion,
          }
        }
      }
      json.processedLoadingExperience = processedLoadingExperience;
    }

    if (dataSource === 'lighthouseResourceSummary') {
      let processedRessourceSummaryItems = {};
      let ressourceSummaryItems = json.lighthouseResult.audits['resource-summary'].details.items;
      ressourceSummaryItems.forEach((element) => {
        switch (element.label) {
          case 'Document':
            processedRessourceSummaryItems.HTMLSize = element.transferSize;
            break;
          case 'Script':
            processedRessourceSummaryItems.JavascriptSize = element.transferSize;
            break;
          case 'Stylesheet':
            processedRessourceSummaryItems.CSSSize = element.transferSize;
            break;
          case 'Font':
            processedRessourceSummaryItems.FontsSize = element.transferSize;
            break;
          case 'Image':
            processedRessourceSummaryItems.ImagesSize = element.transferSize;
            break;
          case 'Media':
            processedRessourceSummaryItems.MediasSize = element.transferSize;
            break;
          case 'Third-party':
            processedRessourceSummaryItems.ThirdPartySize = element.transferSize;
            break;
        }
      });
      json.processedRessourceSummaryItems = processedRessourceSummaryItems;
    }
  }

  fakeRunResponse() {
    return {
      "captchaResult": "CAPTCHA_NOT_NEEDED",
      "kind": "pagespeedonline#result",
      "id": "https://developers.google.com/",
      "loadingExperience": {
        "id": "https://developers.google.com/",
        "metrics": {
          "LARGEST_CONTENTFUL_PAINT_MS": {
            "percentile": 3610,
            "distributions": [{
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
          },
          "FIRST_INPUT_DELAY_MS": {
            "percentile": 4,
            "distributions": [{
                "min": 0,
                "max": 100,
                "proportion": 0.98019876242265125
              },
              {
                "min": 100,
                "max": 300,
                "proportion": 0.012863303956497282
              },
              {
                "min": 300,
                "proportion": 0.0069379336208513021
              }
            ],
            "category": "FAST"
          },
          "FIRST_CONTENTFUL_PAINT_MS": {
            "percentile": 2179,
            "distributions": [{
                "min": 0,
                "max": 1000,
                "proportion": 0.35589527513684815
              },
              {
                "min": 1000,
                "max": 3000,
                "proportion": 0.501566551426102
              },
              {
                "min": 3000,
                "proportion": 0.14253817343704983
              }
            ],
            "category": "AVERAGE"
          },
          "CUMULATIVE_LAYOUT_SHIFT_SCORE": {
            "percentile": 14,
            "distributions": [{
                "min": 0,
                "max": 10,
                "proportion": 0.61887353615465646
              },
              {
                "min": 10,
                "max": 25,
                "proportion": 0.19936179441105398
              },
              {
                "min": 25,
                "proportion": 0.18176466943428962
              }
            ],
            "category": "AVERAGE"
          }
        },
        "overall_category": "AVERAGE",
        "initial_url": "https://developers.google.com/"
      },
      "originLoadingExperience": {
        "id": "https://developers.google.com",
        "metrics": {
          "LARGEST_CONTENTFUL_PAINT_MS": {
            "percentile": 3399,
            "distributions": [{
                "min": 0,
                "max": 2500,
                "proportion": 0.62361416946913917
              },
              {
                "min": 2500,
                "max": 4000,
                "proportion": 0.1812309005979309
              },
              {
                "min": 4000,
                "proportion": 0.19515492993292996
              }
            ],
            "category": "AVERAGE"
          },
          "FIRST_INPUT_DELAY_MS": {
            "percentile": 4,
            "distributions": [{
                "min": 0,
                "max": 100,
                "proportion": 0.95333314340438846
              },
              {
                "min": 100,
                "max": 300,
                "proportion": 0.025495769332757698
              },
              {
                "min": 300,
                "proportion": 0.021171087262853619
              }
            ],
            "category": "FAST"
          },
          "FIRST_CONTENTFUL_PAINT_MS": {
            "percentile": 1917,
            "distributions": [{
                "min": 0,
                "max": 1000,
                "proportion": 0.41785749010306855
              },
              {
                "min": 1000,
                "max": 3000,
                "proportion": 0.46892709630252244
              },
              {
                "min": 3000,
                "proportion": 0.1132154135944089
              }
            ],
            "category": "AVERAGE"
          },
          "CUMULATIVE_LAYOUT_SHIFT_SCORE": {
            "percentile": 25,
            "distributions": [{
                "min": 0,
                "max": 10,
                "proportion": 0.62522653605331679
              },
              {
                "min": 10,
                "max": 25,
                "proportion": 0.12077279565298922
              },
              {
                "min": 25,
                "proportion": 0.25400066829369394
              }
            ],
            "category": "AVERAGE"
          }
        },
        "overall_category": "AVERAGE",
        "initial_url": "https://developers.google.com/"
      },
      "lighthouseResult": {
        "requestedUrl": "https://developers.google.com/",
        "finalUrl": "https://developers.google.com/",
        "lighthouseVersion": "6.0.0",
        "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/81.0.4044.108 Safari/537.36",
        "fetchTime": "2020-05-28T12:30:58.151Z",
        "environment": {
          "networkUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3963.0 Safari/537.36 Chrome-Lighthouse",
          "hostUserAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/81.0.4044.108 Safari/537.36",
          "benchmarkIndex": 738
        },
        "runWarnings": [],
        "configSettings": {
          "emulatedFormFactor": "desktop",
          "locale": "en-US",
          "onlyCategories": [
            "performance"
          ],
          "channel": "lr"
        },
        "audits": {
          "cumulative-layout-shift": {
            "id": "cumulative-layout-shift",
            "title": "Cumulative Layout Shift",
            "description": "Cumulative Layout Shift measures the movement of visible elements within the viewport. [Learn more](https://web.dev/cls).",
            "score": 0.94,
            "scoreDisplayMode": "numeric",
            "displayValue": "0.081",
            "details": {
              "type": "debugdata",
              "items": [{
                "finalLayoutShiftTraceEventFound": true
              }]
            },
            "numericValue": 0.08149930187082273
          },
          "third-party-summary": {
            "id": "third-party-summary",
            "title": "Minimize third-party usage",
            "description": "Third-party code can significantly impact load performance. Limit the number of redundant third-party providers and try to load third-party code after your page has primarily finished loading. [Learn more](https://developers.google.com/web/fundamentals/performance/optimizing-content-efficiency/loading-third-party-javascript/).",
            "score": 1,
            "scoreDisplayMode": "binary",
            "displayValue": "Third-party code blocked the main thread for 0 ms",
            "details": {
              "summary": {
                "wastedMs": 0,
                "wastedBytes": 500039
              },
              "items": [{
                  "blockingTime": 0,
                  "entity": {
                    "url": "https://developers.google.com/speed/libraries/",
                    "text": "Google CDN",
                    "type": "link"
                  },
                  "transferSize": 326314,
                  "mainThreadTime": 352.19799999999867
                },
                {
                  "mainThreadTime": 1.682,
                  "transferSize": 149925,
                  "blockingTime": 0,
                  "entity": {
                    "type": "link",
                    "url": "https://fonts.google.com/",
                    "text": "Google Fonts"
                  }
                },
                {
                  "entity": {
                    "type": "link",
                    "text": "Google Analytics",
                    "url": "https://www.google.com/analytics/analytics/"
                  },
                  "mainThreadTime": 49.649000000000029,
                  "transferSize": 23800,
                  "blockingTime": 0
                }
              ],
              "type": "table",
              "headings": [{
                  "text": "Third-Party",
                  "itemType": "link",
                  "key": "entity"
                },
                {
                  "granularity": 1,
                  "key": "transferSize",
                  "text": "Transfer Size",
                  "itemType": "bytes"
                },
                {
                  "text": "Main-Thread Blocking Time",
                  "key": "blockingTime",
                  "granularity": 1,
                  "itemType": "ms"
                }
              ]
            }
          },
          "final-screenshot": {
            "id": "final-screenshot",
            "title": "Final Screenshot",
            "description": "The last screenshot captured of the pageload.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "timing": 2329,
              "type": "screenshot",
              "data": "data:image/jpeg;base64,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",
              "timestamp": 641017941589
            }
          },
          "speed-index": {
            "id": "speed-index",
            "title": "Speed Index",
            "description": "Speed Index shows how quickly the contents of a page are visibly populated. [Learn more](https://web.dev/speed-index).",
            "score": 0.87,
            "scoreDisplayMode": "numeric",
            "displayValue": "1.4 s",
            "numericValue": 1417.0371420241013
          },
          "timing-budget": {
            "id": "timing-budget",
            "title": "Timing budget",
            "description": "Set a timing budget to help you keep an eye on the performance of your site. Performant sites load fast and respond to user input events quickly. [Learn more](https://developers.google.com/web/tools/lighthouse/audits/budgets).",
            "score": null,
            "scoreDisplayMode": "notApplicable"
          },
          "first-contentful-paint": {
            "id": "first-contentful-paint",
            "title": "First Contentful Paint",
            "description": "First Contentful Paint marks the time at which the first text or image is painted. [Learn more](https://web.dev/first-contentful-paint).",
            "score": 0.98,
            "scoreDisplayMode": "numeric",
            "displayValue": "0.7 s",
            "numericValue": 700
          },
          "critical-request-chains": {
            "id": "critical-request-chains",
            "title": "Avoid chaining critical requests",
            "description": "The Critical Request Chains below show you what resources are loaded with a high priority. Consider reducing the length of chains, reducing the download size of resources, or deferring the download of unnecessary resources to improve page load. [Learn more](https://web.dev/critical-request-chains).",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "8 chains found",
            "details": {
              "longestChain": {
                "duration": 1529.5720000285655,
                "length": 2,
                "transferSize": 11667
              },
              "chains": {
                "7B04E5AA39D999B73929F343D4F8EB60": {
                  "request": {
                    "transferSize": 12866,
                    "endTime": 641016.788959,
                    "url": "https://developers.google.com/",
                    "startTime": 641015.614057,
                    "responseReceivedTime": 641016.788957
                  },
                  "children": {
                    "21.157": {
                      "request": {
                        "responseReceivedTime": 641017.143627,
                        "transferSize": 11667,
                        "url": "https://fonts.gstatic.com/s/roboto/v20/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2",
                        "startTime": 641016.933555,
                        "endTime": 641017.143629
                      }
                    },
                    "21.143": {
                      "request": {
                        "endTime": 641017.018887,
                        "url": "https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2",
                        "startTime": 641016.934623,
                        "transferSize": 11664,
                        "responseReceivedTime": 641017.018885
                      }
                    },
                    "21.114": {
                      "request": {
                        "endTime": 641017.057928,
                        "startTime": 641016.932056,
                        "transferSize": 15464,
                        "responseReceivedTime": 641017.057926,
                        "url": "https://fonts.gstatic.com/s/googlesans/v16/4UabrENHsxJlGDuGo1OIlLU94YtzCwZsPF4o.woff2"
                      }
                    },
                    "21.115": {
                      "request": {
                        "responseReceivedTime": 641017.02077400009,
                        "transferSize": 79911,
                        "startTime": 641016.932322,
                        "endTime": 641017.020776,
                        "url": "https://fonts.gstatic.com/s/materialicons/v51/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2"
                      }
                    },
                    "21.122": {
                      "request": {
                        "url": "https://fonts.gstatic.com/s/roboto/v20/KFOkCnqEu92Fr1Mu51xIIzIXKMny.woff2",
                        "endTime": 641017.032629,
                        "responseReceivedTime": 641017.032627,
                        "startTime": 641016.938299,
                        "transferSize": 13329
                      }
                    },
                    "21.3": {
                      "request": {
                        "endTime": 641016.85057,
                        "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/css/app.css",
                        "responseReceivedTime": 641016.850568,
                        "transferSize": 54215,
                        "startTime": 641016.806909
                      }
                    },
                    "21.109": {
                      "request": {
                        "transferSize": 15257,
                        "url": "https://fonts.gstatic.com/s/googlesans/v16/4UaGrENHsxJlGDuGo1OIlL3Owp5eKQtG.woff2",
                        "endTime": 641017.042152,
                        "startTime": 641016.936114,
                        "responseReceivedTime": 641017.04215
                      }
                    },
                    "21.2": {
                      "request": {
                        "url": "https://fonts.googleapis.com/css?family=Google+Sans:400,500|Roboto:400,400italic,500,500italic,700,700italic|Roboto+Mono:400,500,700|Material+Icons",
                        "transferSize": 2633,
                        "responseReceivedTime": 641016.814045,
                        "startTime": 641016.806641,
                        "endTime": 641016.81406
                      }
                    }
                  }
                }
              },
              "type": "criticalrequestchain"
            }
          },
          "max-potential-fid": {
            "id": "max-potential-fid",
            "title": "Max Potential First Input Delay",
            "description": "The maximum potential First Input Delay that your users could experience is the duration of the longest task. [Learn more](https://web.dev/lighthouse-max-potential-fid).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "60 ms",
            "numericValue": 61
          },
          "server-response-time": {
            "id": "server-response-time",
            "title": "Reduce initial server response time",
            "description": "Keep the server response time for the main document short because all other requests depend on it. [Learn more](https://web.dev/time-to-first-byte).",
            "score": 0,
            "scoreDisplayMode": "binary",
            "displayValue": "Root document took 1,180 ms",
            "details": {
              "type": "opportunity",
              "headings": [],
              "items": [],
              "overallSavingsMs": 575.90000000000009
            },
            "numericValue": 1175.9
          },
          "performance-budget": {
            "id": "performance-budget",
            "title": "Performance budget",
            "description": "Keep the quantity and size of network requests under the targets set by the provided performance budget. [Learn more](https://developers.google.com/web/tools/lighthouse/audits/budgets).",
            "score": null,
            "scoreDisplayMode": "notApplicable"
          },
          "uses-webp-images": {
            "id": "uses-webp-images",
            "title": "Serve images in next-gen formats",
            "description": "Image formats like JPEG 2000, JPEG XR, and WebP often provide better compression than PNG or JPEG, which means faster downloads and less data consumption. [Learn more](https://web.dev/uses-webp-images).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "Potential savings of 8 KB",
            "details": {
              "headings": [{
                  "key": "url",
                  "valueType": "thumbnail"
                },
                {
                  "label": "URL",
                  "valueType": "url",
                  "key": "url"
                },
                {
                  "valueType": "bytes",
                  "label": "Resource Size",
                  "key": "totalBytes"
                },
                {
                  "valueType": "bytes",
                  "key": "wastedBytes",
                  "label": "Potential Savings"
                }
              ],
              "overallSavingsMs": 0,
              "overallSavingsBytes": 8652,
              "type": "opportunity",
              "items": [{
                "fromProtocol": true,
                "wastedBytes": 8652,
                "totalBytes": 21038,
                "isCrossOrigin": false,
                "url": "https://developers.google.com/site-assets/images/home/community-graphic.png"
              }]
            },
            "warnings": [],
            "numericValue": 0
          },
          "main-thread-tasks": {
            "id": "main-thread-tasks",
            "title": "Tasks",
            "description": "Lists the toplevel main thread tasks that executed during page load.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "items": [{
                  "duration": 9.328,
                  "startTime": 1207.908
                },
                {
                  "duration": 9.731,
                  "startTime": 1222.357
                },
                {
                  "startTime": 1269.977,
                  "duration": 32.152
                },
                {
                  "duration": 53.725,
                  "startTime": 1302.18
                },
                {
                  "duration": 85.77,
                  "startTime": 1355.924
                },
                {
                  "duration": 7.447,
                  "startTime": 1446.976
                },
                {
                  "duration": 51.308,
                  "startTime": 1456.358
                },
                {
                  "startTime": 1521.785,
                  "duration": 44.413
                },
                {
                  "startTime": 1566.519,
                  "duration": 8.501
                },
                {
                  "duration": 46.793,
                  "startTime": 1589.354
                },
                {
                  "duration": 16.388,
                  "startTime": 1640.421
                },
                {
                  "duration": 8.598,
                  "startTime": 1657.492
                },
                {
                  "duration": 121.096,
                  "startTime": 1702.4
                },
                {
                  "duration": 5.351,
                  "startTime": 1823.529
                },
                {
                  "startTime": 1835.262,
                  "duration": 5.117
                },
                {
                  "startTime": 1848.377,
                  "duration": 8.842
                },
                {
                  "startTime": 1860.155,
                  "duration": 47.926
                },
                {
                  "duration": 12.957,
                  "startTime": 1908.139
                },
                {
                  "duration": 6.155,
                  "startTime": 1921.297
                },
                {
                  "duration": 13.446,
                  "startTime": 1927.963
                },
                {
                  "startTime": 1941.512,
                  "duration": 42.663
                },
                {
                  "startTime": 1992.436,
                  "duration": 73.302
                },
                {
                  "startTime": 2068.943,
                  "duration": 11.319
                },
                {
                  "duration": 7.182,
                  "startTime": 2080.579
                },
                {
                  "duration": 6.496,
                  "startTime": 2104.446
                },
                {
                  "duration": 8.208,
                  "startTime": 2111.379
                },
                {
                  "duration": 9.199,
                  "startTime": 2510.728
                }
              ],
              "headings": [{
                  "text": "Start Time",
                  "itemType": "ms",
                  "key": "startTime",
                  "granularity": 1
                },
                {
                  "granularity": 1,
                  "text": "End Time",
                  "key": "duration",
                  "itemType": "ms"
                }
              ],
              "type": "table"
            }
          },
          "offscreen-images": {
            "id": "offscreen-images",
            "title": "Defer offscreen images",
            "description": "Consider lazy-loading offscreen and hidden images after all critical resources have finished loading to lower time to interactive. [Learn more](https://web.dev/offscreen-images).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "headings": [],
              "overallSavingsBytes": 0,
              "type": "opportunity",
              "items": [],
              "overallSavingsMs": 0
            },
            "warnings": [],
            "numericValue": 0
          },
          "network-server-latency": {
            "id": "network-server-latency",
            "title": "Server Backend Latencies",
            "description": "Server latencies can impact web performance. If the server latency of an origin is high, it's an indication the server is overloaded or has poor backend performance. [Learn more](https://hpbn.co/primer-on-web-performance/#analyzing-the-resource-waterfall).",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "0 ms",
            "details": {
              "headings": [],
              "items": [],
              "type": "table"
            },
            "numericValue": 0
          },
          "unminified-javascript": {
            "id": "unminified-javascript",
            "title": "Minify JavaScript",
            "description": "Minifying JavaScript files can reduce payload sizes and script parse time. [Learn more](https://web.dev/unminified-javascript).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "items": [],
              "overallSavingsMs": 0,
              "type": "opportunity",
              "overallSavingsBytes": 0,
              "headings": []
            },
            "warnings": [],
            "numericValue": 0
          },
          "largest-contentful-paint-element": {
            "id": "largest-contentful-paint-element",
            "title": "Largest Contentful Paint element",
            "description": "This is the element that was identified as the Largest Contentful Paint. [Learn More](https://web.dev/lighthouse-largest-contentful-paint)",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "1 element found",
            "details": {
              "items": [{
                "node": {
                  "nodeLabel": "img",
                  "snippet": "\u003cimg alt=\"\" src=\"https://developer.android.com/images/home/android-11-preview-hero.svg\" srcset=\"\" sizes=\"(max-width: 600px) 100vw, (max-width: 840px) 50vw, 708px\"\u003e",
                  "path": "1,HTML,1,BODY,1,SECTION,3,SECTION,0,MAIN,1,DEVSITE-CONTENT,0,ARTICLE,0,ARTICLE,3,DIV,0,SECTION,0,DIV,0,DIV,0,DIV,0,FIGURE,0,IMG",
                  "type": "node",
                  "selector": "div.devsite-landing-row-item \u003e div.devsite-landing-row-item-media \u003e figure.devsite-landing-row-item-image \u003e img"
                }
              }],
              "type": "table",
              "headings": [{
                "itemType": "node",
                "key": "node",
                "text": "Element"
              }]
            }
          },
          "largest-contentful-paint": {
            "id": "largest-contentful-paint",
            "title": "Largest Contentful Paint",
            "description": "Largest Contentful Paint marks the time at which the largest text or image is painted. [Learn More](https://web.dev/lighthouse-largest-contentful-paint)",
            "score": 0.82,
            "scoreDisplayMode": "numeric",
            "displayValue": "1.5 s",
            "numericValue": 1450
          },
          "total-blocking-time": {
            "id": "total-blocking-time",
            "title": "Total Blocking Time",
            "description": "Sum of all time periods between FCP and Time to Interactive, when task length exceeded 50ms, expressed in milliseconds. [Learn more](https://web.dev/lighthouse-total-blocking-time).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "10 ms",
            "numericValue": 5.5
          },
          "estimated-input-latency": {
            "id": "estimated-input-latency",
            "title": "Estimated Input Latency",
            "description": "Estimated Input Latency is an estimate of how long your app takes to respond to user input, in milliseconds, during the busiest 5s window of page load. If your latency is higher than 50 ms, users may perceive your app as laggy. [Learn more](https://web.dev/estimated-input-latency).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "10 ms",
            "numericValue": 12.8
          },
          "uses-text-compression": {
            "id": "uses-text-compression",
            "title": "Enable text compression",
            "description": "Text-based resources should be served with compression (gzip, deflate or brotli) to minimize total network bytes. [Learn more](https://web.dev/uses-text-compression).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "overallSavingsBytes": 0,
              "items": [],
              "overallSavingsMs": 0,
              "headings": [],
              "type": "opportunity"
            },
            "numericValue": 0
          },
          "unminified-css": {
            "id": "unminified-css",
            "title": "Minify CSS",
            "description": "Minifying CSS files can reduce network payload sizes. [Learn more](https://web.dev/unminified-css).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "items": [],
              "headings": [],
              "type": "opportunity",
              "overallSavingsMs": 0,
              "overallSavingsBytes": 0
            },
            "numericValue": 0
          },
          "interactive": {
            "id": "interactive",
            "title": "Time to Interactive",
            "description": "Time to interactive is the amount of time it takes for the page to become fully interactive. [Learn more](https://web.dev/interactive).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "1.1 s",
            "numericValue": 1136
          },
          "first-cpu-idle": {
            "id": "first-cpu-idle",
            "title": "First CPU Idle",
            "description": "First CPU Idle marks the first time at which the page's main thread is quiet enough to handle input.  [Learn more](https://web.dev/first-cpu-idle).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "1.0 s",
            "numericValue": 991
          },
          "redirects": {
            "id": "redirects",
            "title": "Avoid multiple page redirects",
            "description": "Redirects introduce additional delays before the page can be loaded. [Learn more](https://web.dev/redirects).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "headings": [],
              "items": [],
              "type": "opportunity",
              "overallSavingsMs": 0
            },
            "numericValue": 0
          },
          "uses-responsive-images": {
            "id": "uses-responsive-images",
            "title": "Properly size images",
            "description": "Serve images that are appropriately-sized to save cellular data and improve load time. [Learn more](https://web.dev/uses-responsive-images).",
            "score": 0.98,
            "scoreDisplayMode": "numeric",
            "displayValue": "Potential savings of 43 KB",
            "details": {
              "type": "opportunity",
              "overallSavingsBytes": 43875,
              "items": [{
                  "url": "https://developer.android.com/images/brand/Android_Robot_480.png",
                  "wastedBytes": 14507,
                  "totalBytes": 15192,
                  "wastedPercent": 95.492369896961009
                },
                {
                  "url": "https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_150x54dp.png",
                  "totalBytes": 6391,
                  "wastedBytes": 5728,
                  "wastedPercent": 89.629629629629619
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/firebase_96dp.png",
                  "wastedPercent": 75,
                  "wastedBytes": 4520,
                  "totalBytes": 6027
                },
                {
                  "totalBytes": 5001,
                  "wastedPercent": 75,
                  "wastedBytes": 3751,
                  "url": "https://www.gstatic.com/images/branding/product/2x/play_prism_64dp.png"
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/google_cloud_96dp.png",
                  "wastedPercent": 75,
                  "totalBytes": 4124,
                  "wastedBytes": 3093
                },
                {
                  "totalBytes": 3819,
                  "wastedPercent": 75,
                  "wastedBytes": 2864,
                  "url": "https://www.gstatic.com/images/branding/product/2x/analytics_64dp.png"
                },
                {
                  "wastedBytes": 2745,
                  "wastedPercent": 75,
                  "url": "https://www.gstatic.com/images/branding/product/2x/firebase_64dp.png",
                  "totalBytes": 3660
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/maps_64dp.png",
                  "totalBytes": 3062,
                  "wastedBytes": 2297,
                  "wastedPercent": 75
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/flutter_96dp.png",
                  "totalBytes": 2990,
                  "wastedBytes": 2243,
                  "wastedPercent": 75
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/google_cloud_64dp.png",
                  "wastedBytes": 2127,
                  "totalBytes": 2836,
                  "wastedPercent": 75
                }
              ],
              "overallSavingsMs": 30,
              "headings": [{
                  "key": "url",
                  "valueType": "thumbnail"
                },
                {
                  "valueType": "url",
                  "key": "url",
                  "label": "URL"
                },
                {
                  "valueType": "bytes",
                  "label": "Resource Size",
                  "key": "totalBytes"
                },
                {
                  "key": "wastedBytes",
                  "valueType": "bytes",
                  "label": "Potential Savings"
                }
              ]
            },
            "warnings": [],
            "numericValue": 30
          },
          "diagnostics": {
            "id": "diagnostics",
            "title": "Diagnostics",
            "description": "Collection of useful page vitals.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "items": [{
                "numTasksOver500ms": 0,
                "numTasksOver25ms": 10,
                "mainDocumentTransferSize": 12866,
                "maxRtt": 0.00024205168908984572,
                "numRequests": 52,
                "throughput": 45273102665.650856,
                "numStylesheets": 5,
                "numScripts": 8,
                "numTasksOver10ms": 14,
                "totalByteWeight": 583850,
                "numFonts": 6,
                "numTasksOver50ms": 5,
                "totalTaskTime": 924.61299999999471,
                "numTasks": 1026,
                "maxServerLatency": null,
                "rtt": 0.00024205168908984572,
                "numTasksOver100ms": 1
              }],
              "type": "debugdata"
            }
          },
          "efficient-animated-content": {
            "id": "efficient-animated-content",
            "title": "Use video formats for animated content",
            "description": "Large GIFs are inefficient for delivering animated content. Consider using MPEG4/WebM videos for animations and PNG/WebP for static images instead of GIF to save network bytes. [Learn more](https://web.dev/efficient-animated-content)",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "headings": [],
              "items": [],
              "overallSavingsMs": 0,
              "type": "opportunity",
              "overallSavingsBytes": 0
            },
            "numericValue": 0
          },
          "total-byte-weight": {
            "id": "total-byte-weight",
            "title": "Avoids enormous network payloads",
            "description": "Large network payloads cost users real money and are highly correlated with long load times. [Learn more](https://web.dev/total-byte-weight).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "Total size was 570 KB",
            "details": {
              "headings": [{
                  "text": "URL",
                  "itemType": "url",
                  "key": "url"
                },
                {
                  "key": "totalBytes",
                  "text": "Transfer Size",
                  "itemType": "bytes"
                }
              ],
              "items": [{
                  "totalBytes": 111749,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/js/devsite_app.js"
                },
                {
                  "url": "https://fonts.gstatic.com/s/materialicons/v51/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2",
                  "totalBytes": 79911
                },
                {
                  "totalBytes": 54215,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/css/app.css"
                },
                {
                  "totalBytes": 35385,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/webcomponents-lite.js"
                },
                {
                  "totalBytes": 21700,
                  "url": "https://developers.google.com/site-assets/images/home/community-graphic.png"
                },
                {
                  "url": "https://www.google-analytics.com/analytics.js",
                  "totalBytes": 19103
                },
                {
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_heading_link_module.js",
                  "totalBytes": 16920
                },
                {
                  "totalBytes": 16444,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/app_loader.js"
                },
                {
                  "totalBytes": 15854,
                  "url": "https://developer.android.com/images/brand/Android_Robot_480.png"
                },
                {
                  "totalBytes": 15770,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_snackbar_module.js"
                }
              ],
              "type": "table"
            },
            "numericValue": 583850
          },
          "no-document-write": {
            "id": "no-document-write",
            "title": "Avoids `document.write()`",
            "description": "For users on slow connections, external scripts dynamically injected via `document.write()` can delay page load by tens of seconds. [Learn more](https://web.dev/no-document-write).",
            "score": 1,
            "scoreDisplayMode": "binary",
            "details": {
              "type": "table",
              "items": [],
              "headings": []
            }
          },
          "mainthread-work-breakdown": {
            "id": "mainthread-work-breakdown",
            "title": "Minimizes main-thread work",
            "description": "Consider reducing the time spent parsing, compiling and executing JS. You may find delivering smaller JS payloads helps with this. [Learn more](https://web.dev/mainthread-work-breakdown)",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "0.9 s",
            "details": {
              "headings": [{
                  "text": "Category",
                  "key": "groupLabel",
                  "itemType": "text"
                },
                {
                  "text": "Time Spent",
                  "granularity": 1,
                  "key": "duration",
                  "itemType": "ms"
                }
              ],
              "type": "table",
              "items": [{
                  "duration": 350.103,
                  "group": "styleLayout",
                  "groupLabel": "Style & Layout"
                },
                {
                  "groupLabel": "Script Evaluation",
                  "group": "scriptEvaluation",
                  "duration": 298.29599999999897
                },
                {
                  "duration": 133.3300000000003,
                  "group": "other",
                  "groupLabel": "Other"
                },
                {
                  "groupLabel": "Rendering",
                  "duration": 68.259000000000157,
                  "group": "paintCompositeRender"
                },
                {
                  "groupLabel": "Parse HTML & CSS",
                  "group": "parseHTML",
                  "duration": 44.149
                },
                {
                  "groupLabel": "Script Parsing & Compilation",
                  "duration": 25.598000000000006,
                  "group": "scriptParseCompile"
                },
                {
                  "groupLabel": "Garbage Collection",
                  "duration": 4.878,
                  "group": "garbageCollection"
                }
              ]
            },
            "numericValue": 924.61299999999949
          },
          "font-display": {
            "id": "font-display",
            "title": "Ensure text remains visible during webfont load",
            "description": "Leverage the font-display CSS feature to ensure text is user-visible while webfonts are loading. [Learn more](https://web.dev/font-display).",
            "score": 0,
            "scoreDisplayMode": "binary",
            "details": {
              "items": [{
                  "url": "https://fonts.gstatic.com/s/googlesans/v16/4UabrENHsxJlGDuGo1OIlLU94YtzCwZsPF4o.woff2",
                  "wastedMs": 125.87200000416487
                },
                {
                  "wastedMs": 88.453999953344464,
                  "url": "https://fonts.gstatic.com/s/materialicons/v51/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2"
                },
                {
                  "wastedMs": 210.07400006055832,
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2"
                },
                {
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2",
                  "wastedMs": 84.264000062830746
                },
                {
                  "wastedMs": 106.03799996897578,
                  "url": "https://fonts.gstatic.com/s/googlesans/v16/4UaGrENHsxJlGDuGo1OIlL3Owp5eKQtG.woff2"
                },
                {
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOkCnqEu92Fr1Mu51xIIzIXKMny.woff2",
                  "wastedMs": 94.329999992623925
                }
              ],
              "headings": [{
                  "key": "url",
                  "text": "URL",
                  "itemType": "url"
                },
                {
                  "key": "wastedMs",
                  "text": "Potential Savings",
                  "itemType": "ms"
                }
              ],
              "type": "table"
            },
            "warnings": []
          },
          "user-timings": {
            "id": "user-timings",
            "title": "User Timing marks and measures",
            "description": "Consider instrumenting your app with the User Timing API to measure your app's real-world performance during key user experiences. [Learn more](https://web.dev/user-timings).",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "9 user timings",
            "details": {
              "items": [{
                  "duration": 95.396,
                  "startTime": 1790.504,
                  "timingType": "Measure",
                  "name": "load"
                },
                {
                  "name": "load",
                  "timingType": "Measure",
                  "startTime": 1790.504,
                  "duration": 116.551
                },
                {
                  "duration": 127.17,
                  "startTime": 1790.504,
                  "timingType": "Measure",
                  "name": "load"
                },
                {
                  "timingType": "Mark",
                  "startTime": 1783.801,
                  "name": "mark_load_start"
                },
                {
                  "timingType": "Mark",
                  "name": "mark_load_start",
                  "startTime": 1788.287
                },
                {
                  "timingType": "Mark",
                  "startTime": 1790.514,
                  "name": "mark_load_start"
                },
                {
                  "startTime": 1885.917,
                  "timingType": "Mark",
                  "name": "mark_load_end"
                },
                {
                  "startTime": 1907.068,
                  "timingType": "Mark",
                  "name": "mark_load_end"
                },
                {
                  "name": "mark_load_end",
                  "timingType": "Mark",
                  "startTime": 1917.683
                }
              ],
              "type": "table",
              "headings": [{
                  "itemType": "text",
                  "text": "Name",
                  "key": "name"
                },
                {
                  "itemType": "text",
                  "key": "timingType",
                  "text": "Type"
                },
                {
                  "granularity": 0.01,
                  "text": "Start Time",
                  "itemType": "ms",
                  "key": "startTime"
                },
                {
                  "itemType": "ms",
                  "text": "Duration",
                  "granularity": 0.01,
                  "key": "duration"
                }
              ]
            }
          },
          "uses-passive-event-listeners": {
            "id": "uses-passive-event-listeners",
            "title": "Uses passive listeners to improve scrolling performance",
            "description": "Consider marking your touch and wheel event listeners as `passive` to improve your page's scroll performance. [Learn more](https://web.dev/uses-passive-event-listeners).",
            "score": 1,
            "scoreDisplayMode": "binary",
            "details": {
              "type": "table",
              "items": [],
              "headings": []
            }
          },
          "uses-long-cache-ttl": {
            "id": "uses-long-cache-ttl",
            "title": "Uses efficient cache policy on static assets",
            "description": "A long cache lifetime can speed up repeat visits to your page. [Learn more](https://web.dev/uses-long-cache-ttl).",
            "score": 0.96,
            "scoreDisplayMode": "numeric",
            "displayValue": "2 resources found",
            "details": {
              "items": [{
                  "url": "https://www.google-analytics.com/plugins/ua/linkid.js",
                  "debugData": {
                    "public": true,
                    "type": "debugdata",
                    "max-age": 3600
                  },
                  "cacheHitProbability": 0.2,
                  "cacheLifetimeMs": 3600000,
                  "totalBytes": 1495,
                  "wastedBytes": 1196
                },
                {
                  "debugData": {
                    "public": true,
                    "type": "debugdata",
                    "max-age": 7200
                  },
                  "totalBytes": 19103,
                  "url": "https://www.google-analytics.com/analytics.js",
                  "cacheLifetimeMs": 7200000,
                  "cacheHitProbability": 0.25,
                  "wastedBytes": 14327.25
                }
              ],
              "type": "table",
              "headings": [{
                  "itemType": "url",
                  "key": "url",
                  "text": "URL"
                },
                {
                  "displayUnit": "duration",
                  "key": "cacheLifetimeMs",
                  "text": "Cache TTL",
                  "itemType": "ms"
                },
                {
                  "granularity": 1,
                  "itemType": "bytes",
                  "key": "totalBytes",
                  "text": "Transfer Size",
                  "displayUnit": "kb"
                }
              ],
              "summary": {
                "wastedBytes": 15523.25
              }
            },
            "numericValue": 15523.25
          },
          "layout-shift-elements": {
            "id": "layout-shift-elements",
            "title": "Avoid large layout shifts",
            "description": "These DOM elements contribute most to the CLS of the page.",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "No elements found",
            "details": {
              "items": [],
              "headings": [],
              "type": "table"
            }
          },
          "metrics": {
            "id": "metrics",
            "title": "Metrics",
            "description": "Collects all available metrics.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "type": "debugdata",
              "items": [{
                  "observedFirstVisualChangeTs": 641017040982,
                  "largestContentfulPaint": 1450,
                  "observedFirstContentfulPaintTs": 641017061947,
                  "cumulativeLayoutShift": 0.08149930187082273,
                  "totalBlockingTime": 6,
                  "observedNavigationStart": 0,
                  "firstContentfulPaint": 700,
                  "firstMeaningfulPaint": 700,
                  "interactive": 1136,
                  "observedFirstPaintTs": 641017061947,
                  "observedDomContentLoaded": 1274,
                  "observedNavigationStartTs": 641015612982,
                  "observedCumulativeLayoutShift": 0.08149930187082273,
                  "observedDomContentLoadedTs": 641016887011,
                  "observedLastVisualChange": 2295,
                  "observedLargestContentfulPaintTs": 641017693849,
                  "firstCPUIdle": 991,
                  "observedSpeedIndexTs": 641017203619,
                  "observedFirstContentfulPaint": 1449,
                  "maxPotentialFID": 61,
                  "estimatedInputLatency": 13,
                  "observedSpeedIndex": 1591,
                  "observedLargestContentfulPaint": 2081,
                  "observedLastVisualChangeTs": 641017907982,
                  "observedLoad": 2062,
                  "observedTraceEndTs": 641018738719,
                  "observedTraceEnd": 3126,
                  "observedFirstPaint": 1449,
                  "speedIndex": 1417,
                  "observedFirstVisualChange": 1428,
                  "observedLoadTs": 641017674494,
                  "observedFirstMeaningfulPaint": 1559,
                  "observedFirstMeaningfulPaintTs": 641017172084
                },
                {
                  "lcpInvalidated": false
                }
              ]
            },
            "numericValue": 1136
          },
          "uses-rel-preconnect": {
            "id": "uses-rel-preconnect",
            "title": "Preconnect to required origins",
            "description": "Consider adding `preconnect` or `dns-prefetch` resource hints to establish early connections to important third-party origins. [Learn more](https://web.dev/uses-rel-preconnect).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "warnings": [
              "More than 2 preconnect links were found. Preconnect links should be used sparingly and only to the most important origins."
            ]
          },
          "uses-optimized-images": {
            "id": "uses-optimized-images",
            "title": "Efficiently encode images",
            "description": "Optimized images load faster and consume less cellular data. [Learn more](https://web.dev/uses-optimized-images).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "headings": [],
              "overallSavingsMs": 0,
              "overallSavingsBytes": 0,
              "type": "opportunity",
              "items": []
            },
            "warnings": [],
            "numericValue": 0
          },
          "first-meaningful-paint": {
            "id": "first-meaningful-paint",
            "title": "First Meaningful Paint",
            "description": "First Meaningful Paint measures when the primary content of a page is visible. [Learn more](https://web.dev/first-meaningful-paint).",
            "score": 0.98,
            "scoreDisplayMode": "numeric",
            "displayValue": "0.7 s",
            "numericValue": 700
          },
          "screenshot-thumbnails": {
            "id": "screenshot-thumbnails",
            "title": "Screenshot Thumbnails",
            "description": "This is what the load of your site looked like.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "items": [{
                  "timing": 300,
                  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAFMAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD//Z",
                  "timestamp": 641015912982
                },
                {
                  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAFMAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD//Z",
                  "timestamp": 641016212982,
                  "timing": 600
                },
                {
                  "timing": 900,
                  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAFMAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD//Z",
                  "timestamp": 641016512982
                },
                {
                  "timestamp": 641016812982,
                  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAFMAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/AP1ToAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD//Z",
                  "timing": 1200
                },
                {
                  "timestamp": 641017112982,
                  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRQBAwQEBQQFCQUFCRQNCw0UFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFP/AABEIAFMAeAMBEQACEQEDEQH/xAGiAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgsQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+gEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoLEQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2gAMAwEAAhEDEQA/APY9T/4Ku/Cy7EptdN8eWMjRFE26Zp7ojHo+Guckj0zj1Br1v7MquUXzKyeuu/k9H+Fjx/7Uo8slZ3e22n42+8oa/wD8FTfhtqVh5enH4iaPdLEVW4j0nS5Q0mMB3V5jnnnClc+1CyyslZyQ5ZpQk21FpdtNPxNy2/4K1fCSCPa+geOpznO+SxsQf0uQKP7Nq90L+1KPZ/h/mTf8PcPhD/0LXjf/AMAbP/5Ko/s2r3Qf2pR7P8P8w/4e4fCH/oWvG/8A4A2f/wAlUf2bV7oP7Uo9n+H+Yf8AD3D4Q/8AQteN/wDwBs//AJKo/s2r3Qf2pR7P8P8AMP8Ah7h8If8AoWvG/wD4A2f/AMlUf2bV7oP7Uo9n+H+Yf8PcPhD/ANC143/8AbP/AOSqP7Nq90H9qUez/D/MP+HuHwh/6Frxv/4A2f8A8lUf2bV7oP7Uo9n+H+Yf8PcPhD/0LXjf/wAAbP8A+SqP7Nq90H9qUez/AA/zD/h7h8If+ha8b/8AgDZ//JVH9m1e6D+1KPZ/h/mH/D3D4Q/9C143/wDAGz/+SqP7Nq90H9qUez/D/MP+HuHwh/6Frxv/AOANn/8AJVH9m1e6D+1KPZ/h/mH/AA9w+EP/AELXjf8A8AbP/wCSqP7Nq90H9qUez/D/ADD/AIe4fCH/AKFrxv8A+ANn/wDJVH9m1e6D+1KPZ/h/mfkdX0p8uFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB6Wv7NXxhUcfCrxyPp4cvB/7Trn+sUf51950/V638j+5i/8ADNnxjIP/ABavx10/6F29/wDjdT7el/OvvD6vW/kf3Df+GZ/i/wD9Eo8cf+E3ef8Axur+sUf5196F9Wr/AMj+5h/wzP8AF/8A6JR44/8ACbvP/jdH1ij/ADr70H1av/I/uYf8Mz/F/wD6JR44/wDCbvP/AI3R9Yo/zr70H1av/I/uYf8ADM/xf/6JR44/8Ju8/wDjdH1ij/OvvQfVq/8AI/uYf8Mz/F//AKJR44/8Ju8/+N0fWKP86+9B9Wr/AMj+5h/wzP8AF/8A6JR44/8ACbvP/jdH1ij/ADr70H1av/I/uYf8Mz/F/wD6JR44/wDCbvP/AI3R9Yo/zr70H1av/I/uYf8ADM/xf/6JR44/8Ju8/wDjdH1ij/OvvQfVq/8AI/uYf8Mz/F//AKJR44/8Ju8/+N0fWKP86+9B9Wr/AMj+5h/wzP8AF/8A6JR44/8ACbvP/jdH1ij/ADr70H1av/I/uYf8Mz/F/wD6JR44/wDCbvP/AI3R9Yo/zr70H1av/I/uYf8ADM/xf/6JR44/8Ju8/wDjdH1ij/OvvQfVq/8AI/uYf8Mz/F//AKJR44/8Ju8/+N0fWKP86+9B9Wr/AMj+5n9AlfFn3AUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAFABQAUAcD8TvGGu+HJbSHRY4keSN3aa50i8v42YA7U/0blOQMlhwGBAbBFebKtiKmYUcHShaD1lN7Jdo6pOT/AL0opLVX1S6VVwWGoTq4u7b0iou2veXuy09FrtdNq/a6beNqGnWt01vNaNPEsht7hQssWQDtcAkBhnBwTyOtepOPLJx7HJF80U7WuWakoQ9KTA5bwp4o1HVtZ1fT7/TmthaTyCGdQdrxh8Ju4wGIwRycjmvkspzqvjsdisFXouPspNKWtmr+7utG42e+q1Wh7ONwVHD0aVWjU5uZK67Oyb+V9Dqq+uPGCgDG8XardaJ4evr6ytzdXEETSLGqFzx1IUcsQMkKMZxjIzkdWFpRrVo05uyf9W10V+728zgx9ephsNOrTjdpefzdlduy1sld7aXupPCuox6x4c0y/iuTeRXVtHOlwWjbzFZQwbMZKHIPVSR6Ejms60PZ1JQtszfDzc6UJPqk+n6XX3N+pq1idAUAISB1oAAc0ALQAUANbHeiwrijGOKBi0AFACAAUALQAUAJjNAABigBaACgDN8SaXPrnh/UtOtr2XTLi7tpII72DPmW7MpAkXBBypORgg8dRW9CpGjVhUnFSUWnZ7O3R+pjWpyq05QjLlbTV1ur9UYHw68Ma/4XtLq01vxDdeIli8qK1uLqONXKCJd7EqNxJkL/AH2YhVUckFm5p16mJxVerKkqcHL3Ip3tGy8u91+VkawpwpUaUIylKSjaTdrOXNLVdfhsndvY7GqGFAHn/wAXfBviTxhp9lD4c1htImDmKaUXU0Hlo+AZ18plaSSMBisbMEYtlvuisnUxNGpCeHcbaqSlFSun2v8AC07O+rtdaXuYYqHtsNOjFe+3G0lJx5bPXb4lZt8r0bSO/XgVqbi0AFABQAUAFABQAUAFABQAUAFABQAUAUdS1zTtG8v7ff21l5mdn2iVY92OuMnnGR+dc9XEUaFvazUb92l+ZpCnOp8EW/RXLoORXQZi0AITigWxXsdRtdUgE9ncxXUJZlEkLhlJVirDI9CCD7g0dbMzpVadaCqU5XT2a2LNBqFACE4pXsAKwboc0wFoAKACgAoAKACgDiPiV8Przx3/AGeLXUrXTfsvmEvPYi5YswG0rl127Su7uCQARjIPzmb5LSzd0pVLJwbabjzPW22qtsn1u0r6XT9/KszjlvPzQcua2im4rTvZO99uml+rTXbKNoxX0Z4ItAhGGRigDgfhh8JLb4b3es3i3819eapM0sxKhIlG9mUKo54DAEszcgkbQxFa42pLHY369Vb5lFQSu1FRTutL2b/vNOXRNR0PIyfKsJkmCjg8JTSd7zm9Zzk+spWVkr2jFJRS3vJyk+/rI9cKAOF+Lvwh0n4y6JpmmaxcXNvBp+oR6lEbdYnDSorqFdJY3R0IkOVKkHocjIPm4/A08wpxp1G1Z30tuvVM+lyLP8Tw/Vq1sLFSdSDg783wtpuzjKMk9NGnoX/hd8ONN+E3gnT/AAtpM1zcafYmQxyXbK0p3yNI2SqqPvOcYA4xWmBwcMBQVCm20r7+foc2d5xic/zCpmWLSU52uoppaRUVu29l1Z1ddx4YUAFABQAUAFABQAUAFABQAUAFABQAUAFABQB//9k=",
                  "timing": 1500
                },
                {
                  "timing": 1800,
                  "timestamp": 641017412982,
                  "data": "data:image/jpeg;base64,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"
                },
                {
                  "data": "data:image/jpeg;base64,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",
                  "timing": 2100,
                  "timestamp": 641017712982
                },
                {
                  "data": "data:image/jpeg;base64,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",
                  "timestamp": 641018012982,
                  "timing": 2400
                },
                {
                  "data": "data:image/jpeg;base64,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",
                  "timestamp": 641018312982,
                  "timing": 2700
                },
                {
                  "timestamp": 641018612982,
                  "data": "data:image/jpeg;base64,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",
                  "timing": 3000
                }
              ],
              "type": "filmstrip",
              "scale": 3000
            }
          },
          "render-blocking-resources": {
            "id": "render-blocking-resources",
            "title": "Eliminate render-blocking resources",
            "description": "Resources are blocking the first paint of your page. Consider delivering critical JS/CSS inline and deferring all non-critical JS/styles. [Learn more](https://web.dev/render-blocking-resources).",
            "score": 0.97,
            "scoreDisplayMode": "numeric",
            "displayValue": "Potential savings of 40 ms",
            "details": {
              "headings": [{
                  "key": "url",
                  "label": "URL",
                  "valueType": "url"
                },
                {
                  "key": "totalBytes",
                  "label": "Transfer Size",
                  "valueType": "bytes"
                },
                {
                  "label": "Potential Savings",
                  "key": "wastedMs",
                  "valueType": "timespanMs"
                }
              ],
              "overallSavingsMs": 40,
              "type": "opportunity",
              "items": [{
                  "totalBytes": 2633,
                  "wastedMs": 230,
                  "url": "https://fonts.googleapis.com/css?family=Google+Sans:400,500|Roboto:400,400italic,500,500italic,700,700italic|Roboto+Mono:400,500,700|Material+Icons"
                },
                {
                  "totalBytes": 54215,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/css/app.css",
                  "wastedMs": 430
                }
              ]
            },
            "numericValue": 40
          },
          "uses-rel-preload": {
            "id": "uses-rel-preload",
            "title": "Preload key requests",
            "description": "Consider using `\u003clink rel=preload\u003e` to prioritize fetching resources that are currently requested later in page load. [Learn more](https://web.dev/uses-rel-preload).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "details": {
              "overallSavingsMs": 0,
              "type": "opportunity",
              "items": [],
              "headings": []
            },
            "numericValue": 0
          },
          "bootup-time": {
            "id": "bootup-time",
            "title": "JavaScript execution time",
            "description": "Consider reducing the time spent parsing, compiling, and executing JS. You may find delivering smaller JS payloads helps with this. [Learn more](https://web.dev/bootup-time).",
            "score": 1,
            "scoreDisplayMode": "numeric",
            "displayValue": "0.2 s",
            "details": {
              "summary": {
                "wastedMs": 195.1999999999999
              },
              "items": [{
                  "total": 401.44000000000005,
                  "url": "https://developers.google.com/",
                  "scripting": 5.4079999999999959,
                  "scriptParseCompile": 1.423
                },
                {
                  "total": 224.51299999999986,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/js/devsite_app.js",
                  "scripting": 155.06999999999991,
                  "scriptParseCompile": 12.946
                },
                {
                  "scriptParseCompile": 0.272,
                  "total": 119.64400000000005,
                  "url": "Unattributable",
                  "scripting": 20.080999999999992
                }
              ],
              "headings": [{
                  "itemType": "url",
                  "key": "url",
                  "text": "URL"
                },
                {
                  "granularity": 1,
                  "text": "Total CPU Time",
                  "itemType": "ms",
                  "key": "total"
                },
                {
                  "granularity": 1,
                  "itemType": "ms",
                  "key": "scripting",
                  "text": "Script Evaluation"
                },
                {
                  "granularity": 1,
                  "text": "Script Parse",
                  "key": "scriptParseCompile",
                  "itemType": "ms"
                }
              ],
              "type": "table"
            },
            "numericValue": 195.1999999999999
          },
          "network-requests": {
            "id": "network-requests",
            "title": "Network Requests",
            "description": "Lists the network requests that were made during page load.",
            "score": null,
            "scoreDisplayMode": "informative",
            "details": {
              "items": [{
                  "finished": true,
                  "resourceSize": 113728,
                  "endTime": 1174.9019999988377,
                  "startTime": 0,
                  "transferSize": 12866,
                  "statusCode": 200,
                  "url": "https://developers.google.com/",
                  "resourceType": "Document",
                  "mimeType": "text/html"
                },
                {
                  "transferSize": 2633,
                  "resourceSize": 26356,
                  "endTime": 1200.0029999762774,
                  "mimeType": "text/css",
                  "resourceType": "Stylesheet",
                  "finished": true,
                  "url": "https://fonts.googleapis.com/css?family=Google+Sans:400,500|Roboto:400,400italic,500,500italic,700,700italic|Roboto+Mono:400,500,700|Material+Icons",
                  "startTime": 1192.5839999457821,
                  "statusCode": 200
                },
                {
                  "mimeType": "text/css",
                  "finished": true,
                  "statusCode": 200,
                  "resourceType": "Stylesheet",
                  "transferSize": 54215,
                  "endTime": 1236.5129999816418,
                  "startTime": 1192.8520000074059,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/css/app.css",
                  "resourceSize": 616726
                },
                {
                  "mimeType": "image/svg+xml",
                  "transferSize": 2988,
                  "resourceSize": 6014,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/images/lockup.svg",
                  "statusCode": 200,
                  "startTime": 1194.1869999282062,
                  "endTime": 1198.4790000133216,
                  "resourceType": "Image",
                  "finished": true
                },
                {
                  "statusCode": 200,
                  "transferSize": 1690,
                  "finished": true,
                  "resourceSize": 1825,
                  "url": "https://developer.android.com/images/home/android-11-preview-hero.svg",
                  "resourceType": "Image",
                  "startTime": 1194.3849999224767,
                  "mimeType": "image/svg+xml",
                  "endTime": 1584.1119999531657
                },
                {
                  "resourceType": "Image",
                  "url": "https://developer.android.com/images/brand/Android_Robot_480.png",
                  "statusCode": 200,
                  "resourceSize": 15192,
                  "endTime": 1413.1539999507368,
                  "finished": true,
                  "transferSize": 15854,
                  "mimeType": "image/png",
                  "startTime": 1194.5769999874756
                },
                {
                  "transferSize": 3441,
                  "endTime": 1200.5009999265894,
                  "statusCode": 200,
                  "resourceSize": 2836,
                  "url": "https://www.gstatic.com/images/branding/product/2x/google_cloud_64dp.png",
                  "startTime": 1195.1160000171512,
                  "mimeType": "image/png",
                  "resourceType": "Image",
                  "finished": true
                },
                {
                  "url": "https://www.gstatic.com/images/branding/product/2x/firebase_64dp.png",
                  "resourceType": "Image",
                  "statusCode": 200,
                  "resourceSize": 3660,
                  "startTime": 1195.5159999197349,
                  "transferSize": 4264,
                  "mimeType": "image/png",
                  "finished": true,
                  "endTime": 1200.7580000208691
                },
                {
                  "resourceType": "Image",
                  "transferSize": 2840,
                  "resourceSize": 2236,
                  "endTime": 1202.0100000081584,
                  "url": "https://www.gstatic.com/images/branding/product/2x/flutter_64dp.png",
                  "mimeType": "image/png",
                  "startTime": 1195.7809999585152,
                  "statusCode": 200,
                  "finished": true
                },
                {
                  "resourceType": "Image",
                  "url": "https://www.gstatic.com/images/branding/product/2x/assistant_64dp.png",
                  "mimeType": "image/png",
                  "resourceSize": 2322,
                  "statusCode": 200,
                  "transferSize": 2926,
                  "endTime": 1201.0219999356195,
                  "finished": true,
                  "startTime": 1196.0079999407753
                },
                {
                  "endTime": 1201.6109999967739,
                  "statusCode": 200,
                  "resourceSize": 3062,
                  "transferSize": 3666,
                  "startTime": 1196.3659999892116,
                  "url": "https://www.gstatic.com/images/branding/product/2x/maps_64dp.png",
                  "resourceType": "Image",
                  "finished": true,
                  "mimeType": "image/png"
                },
                {
                  "mimeType": "image/png",
                  "resourceType": "Image",
                  "url": "https://developers.google.com/site-assets/images/products/tensorflow-logo-196_480.png",
                  "transferSize": 3938,
                  "startTime": 1197.1859999466687,
                  "endTime": 1742.5720000173897,
                  "finished": true,
                  "statusCode": 200,
                  "resourceSize": 3277
                },
                {
                  "mimeType": "image/png",
                  "startTime": 1197.7229999611154,
                  "url": "https://developers.google.com/web/images/web-fundamentals-icon192x192_480.png",
                  "statusCode": 200,
                  "resourceType": "Image",
                  "endTime": 1431.5909999422729,
                  "resourceSize": 3899,
                  "finished": true,
                  "transferSize": 4560
                },
                {
                  "url": "https://developers.google.com/ads/images/ads_192px_clr.svg",
                  "mimeType": "image/svg+xml",
                  "finished": true,
                  "resourceType": "Image",
                  "transferSize": 1542,
                  "startTime": 1203.6790000274777,
                  "resourceSize": 936,
                  "statusCode": 200,
                  "endTime": 1429.6809999505058
                },
                {
                  "resourceType": "Image",
                  "endTime": 1208.3400000119582,
                  "finished": true,
                  "resourceSize": 3819,
                  "transferSize": 4424,
                  "mimeType": "image/png",
                  "url": "https://www.gstatic.com/images/branding/product/2x/analytics_64dp.png",
                  "startTime": 1203.9569999324158,
                  "statusCode": 200
                },
                {
                  "mimeType": "image/png",
                  "resourceSize": 5001,
                  "finished": true,
                  "resourceType": "Image",
                  "endTime": 1207.7819999540225,
                  "statusCode": 200,
                  "transferSize": 5605,
                  "url": "https://www.gstatic.com/images/branding/product/2x/play_prism_64dp.png",
                  "startTime": 1204.1489999974146
                },
                {
                  "startTime": 1204.2880000080913,
                  "mimeType": "image/png",
                  "resourceSize": 1336,
                  "statusCode": 200,
                  "finished": true,
                  "resourceType": "Image",
                  "transferSize": 1940,
                  "endTime": 1208.9319999795407,
                  "url": "https://www.gstatic.com/images/branding/product/2x/youtube_64dp.png"
                },
                {
                  "startTime": 1204.520000028424,
                  "statusCode": 200,
                  "endTime": 1813.4139999747276,
                  "finished": true,
                  "resourceSize": 668,
                  "url": "https://developers.google.com/site-assets/images/home/card-header-grid_720.png",
                  "transferSize": 1328,
                  "mimeType": "image/png",
                  "resourceType": "Image"
                },
                {
                  "finished": true,
                  "resourceSize": 2369,
                  "resourceType": "Image",
                  "mimeType": "image/svg+xml",
                  "url": "https://developer.android.com/images/distribute/play-store-icon.svg",
                  "startTime": 1204.6540000010282,
                  "transferSize": 1940,
                  "statusCode": 200,
                  "endTime": 1433.4210000233725
                },
                {
                  "endTime": 1209.5249999547377,
                  "startTime": 1204.8799999756739,
                  "resourceSize": 4124,
                  "statusCode": 200,
                  "finished": true,
                  "mimeType": "image/png",
                  "resourceType": "Image",
                  "url": "https://www.gstatic.com/images/branding/product/2x/google_cloud_96dp.png",
                  "transferSize": 4728
                },
                {
                  "mimeType": "image/png",
                  "url": "https://www.gstatic.com/images/branding/googlelogo/2x/googlelogo_color_150x54dp.png",
                  "resourceSize": 6391,
                  "resourceType": "Image",
                  "finished": true,
                  "startTime": 1205.2559999283403,
                  "endTime": 1210.1669999537989,
                  "transferSize": 6995,
                  "statusCode": 200
                },
                {
                  "resourceSize": 2990,
                  "transferSize": 3595,
                  "startTime": 1205.4210000205785,
                  "url": "https://www.gstatic.com/images/branding/product/2x/flutter_96dp.png",
                  "finished": true,
                  "mimeType": "image/png",
                  "statusCode": 200,
                  "resourceType": "Image",
                  "endTime": 1209.8919999552891
                },
                {
                  "mimeType": "image/png",
                  "resourceSize": 6027,
                  "endTime": 1212.7280000131577,
                  "resourceType": "Image",
                  "transferSize": 6632,
                  "url": "https://www.gstatic.com/images/branding/product/2x/firebase_96dp.png",
                  "finished": true,
                  "statusCode": 200,
                  "startTime": 1205.5229999823496
                },
                {
                  "mimeType": "text/html",
                  "endTime": 1487.3149999184534,
                  "url": "https://developers.google.com/_static/images/lockup-developers.svg",
                  "statusCode": 301,
                  "transferSize": 957,
                  "resourceSize": 0,
                  "finished": true,
                  "startTime": 1205.7769999373704
                },
                {
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/app_loader.js",
                  "mimeType": "text/javascript",
                  "startTime": 1273.1979999225587,
                  "resourceSize": 48789,
                  "endTime": 1427.2110000019893,
                  "resourceType": "Script",
                  "finished": true,
                  "transferSize": 16444,
                  "statusCode": 200
                },
                {
                  "mimeType": "image/svg+xml",
                  "url": "data:image/svg+xml;utf8,\u003csvg xmlns='http://www.w3.org/2000/svg' width='20' height='4' viewBox='0 0 2",
                  "resourceType": "Image",
                  "statusCode": 200,
                  "resourceSize": 129,
                  "startTime": 1296.2929999921471,
                  "transferSize": 0,
                  "finished": true,
                  "endTime": 1296.3349999627098
                },
                {
                  "mimeType": "image/png",
                  "url": "https://developers.google.com/site-assets/images/home/events-graphic.png",
                  "finished": true,
                  "resourceType": "Image",
                  "transferSize": 15542,
                  "resourceSize": 14880,
                  "endTime": 1586.6570000071079,
                  "startTime": 1303.7949999561533,
                  "statusCode": 200
                },
                {
                  "endTime": 1658.1160000059754,
                  "resourceSize": 21038,
                  "statusCode": 200,
                  "finished": true,
                  "transferSize": 21700,
                  "startTime": 1304.4760000193492,
                  "resourceType": "Image",
                  "mimeType": "image/png",
                  "url": "https://developers.google.com/site-assets/images/home/community-graphic.png"
                },
                {
                  "finished": true,
                  "resourceType": "Font",
                  "mimeType": "font/woff2",
                  "endTime": 1443.8709999667481,
                  "statusCode": 200,
                  "resourceSize": 14816,
                  "url": "https://fonts.gstatic.com/s/googlesans/v16/4UabrENHsxJlGDuGo1OIlLU94YtzCwZsPF4o.woff2",
                  "startTime": 1317.9989999625832,
                  "transferSize": 15464
                },
                {
                  "statusCode": 200,
                  "finished": true,
                  "url": "https://fonts.gstatic.com/s/materialicons/v51/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2",
                  "mimeType": "font/woff2",
                  "resourceType": "Font",
                  "endTime": 1406.7189999623224,
                  "startTime": 1318.2650000089779,
                  "transferSize": 79911,
                  "resourceSize": 79264
                },
                {
                  "finished": true,
                  "resourceSize": 11020,
                  "resourceType": "Font",
                  "startTime": 1319.4979999680072,
                  "transferSize": 11667,
                  "endTime": 1529.5720000285655,
                  "statusCode": 200,
                  "mimeType": "font/woff2",
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2"
                },
                {
                  "finished": true,
                  "mimeType": "font/woff2",
                  "endTime": 1404.8300000140443,
                  "resourceSize": 11016,
                  "resourceType": "Font",
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2",
                  "transferSize": 11664,
                  "startTime": 1320.5659999512136,
                  "statusCode": 200
                },
                {
                  "endTime": 1428.0949999811128,
                  "transferSize": 15257,
                  "url": "https://fonts.gstatic.com/s/googlesans/v16/4UaGrENHsxJlGDuGo1OIlL3Owp5eKQtG.woff2",
                  "statusCode": 200,
                  "startTime": 1322.057000012137,
                  "resourceSize": 14608,
                  "finished": true,
                  "resourceType": "Font",
                  "mimeType": "font/woff2"
                },
                {
                  "finished": true,
                  "resourceSize": 12680,
                  "transferSize": 13329,
                  "mimeType": "font/woff2",
                  "resourceType": "Font",
                  "statusCode": 200,
                  "url": "https://fonts.gstatic.com/s/roboto/v20/KFOkCnqEu92Fr1Mu51xIIzIXKMny.woff2",
                  "startTime": 1324.242000002414,
                  "endTime": 1418.5719999950379
                },
                {
                  "finished": true,
                  "resourceSize": 6014,
                  "mimeType": "image/svg+xml",
                  "statusCode": 200,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/images/lockup-developers.svg",
                  "startTime": 1487.62499995064,
                  "endTime": 1491.4349999744445,
                  "transferSize": 2988,
                  "resourceType": "Image"
                },
                {
                  "finished": true,
                  "endTime": 1551.1159999296069,
                  "resourceSize": 114679,
                  "transferSize": 35385,
                  "mimeType": "text/javascript",
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/webcomponents-lite.js",
                  "resourceType": "Script",
                  "statusCode": 200,
                  "startTime": 1544.0810000291094
                },
                {
                  "statusCode": 200,
                  "transferSize": 111749,
                  "endTime": 1638.2829999784008,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/js/devsite_app.js",
                  "finished": true,
                  "mimeType": "text/javascript",
                  "startTime": 1626.086000003852,
                  "resourceType": "Script",
                  "resourceSize": 398624
                },
                {
                  "statusCode": 200,
                  "transferSize": 19103,
                  "resourceType": "Script",
                  "mimeType": "text/javascript",
                  "url": "https://www.google-analytics.com/analytics.js",
                  "finished": true,
                  "startTime": 1698.3599999221042,
                  "resourceSize": 45892,
                  "endTime": 1702.9349999502301
                },
                {
                  "mimeType": "application/json",
                  "endTime": 2046.6599999926984,
                  "statusCode": 200,
                  "resourceSize": 226,
                  "url": "https://developers.google.com/_d/profile/ogb",
                  "finished": true,
                  "resourceType": "Fetch",
                  "startTime": 1768.1679999222979,
                  "transferSize": 1073
                },
                {
                  "finished": true,
                  "resourceType": "Script",
                  "statusCode": 200,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_heading_link_module.js",
                  "endTime": 1789.9350000079721,
                  "transferSize": 16920,
                  "mimeType": "text/javascript",
                  "resourceSize": 47458,
                  "startTime": 1784.1969999717548
                },
                {
                  "transferSize": 1037,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/css/devsite_heading_link.css",
                  "startTime": 1785.1429999573156,
                  "mimeType": "text/css",
                  "finished": true,
                  "endTime": 1788.8109999476,
                  "statusCode": 200,
                  "resourceSize": 1352,
                  "resourceType": "Stylesheet"
                },
                {
                  "endTime": 1795.0489999493584,
                  "resourceSize": 44528,
                  "finished": true,
                  "transferSize": 15770,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_snackbar_module.js",
                  "resourceType": "Script",
                  "startTime": 1788.5019999230281,
                  "mimeType": "text/javascript",
                  "statusCode": 200
                },
                {
                  "finished": true,
                  "statusCode": 200,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/css/devsite_snackbar.css",
                  "endTime": 1794.4969999371096,
                  "mimeType": "text/css",
                  "transferSize": 1515,
                  "resourceSize": 3291,
                  "startTime": 1789.5459999563172,
                  "resourceType": "Stylesheet"
                },
                {
                  "endTime": 1796.6039999155328,
                  "mimeType": "text/javascript",
                  "startTime": 1790.8390000229701,
                  "statusCode": 200,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_tooltip_module.js",
                  "finished": true,
                  "transferSize": 15272,
                  "resourceSize": 41962,
                  "resourceType": "Script"
                },
                {
                  "transferSize": 975,
                  "statusCode": 200,
                  "endTime": 1795.9140000166371,
                  "resourceType": "Stylesheet",
                  "resourceSize": 558,
                  "mimeType": "text/css",
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/css/devsite_tooltip.css",
                  "finished": true,
                  "startTime": 1791.3730000145733
                },
                {
                  "mimeType": "text/javascript",
                  "statusCode": 200,
                  "startTime": 1838.1309999385849,
                  "finished": true,
                  "resourceType": "Script",
                  "transferSize": 1495,
                  "resourceSize": 1569,
                  "endTime": 1844.5529999444261,
                  "url": "https://www.google-analytics.com/plugins/ua/linkid.js"
                },
                {
                  "startTime": 1878.0319999204949,
                  "resourceType": "Image",
                  "finished": true,
                  "resourceSize": 35,
                  "transferSize": 630,
                  "statusCode": 200,
                  "mimeType": "image/gif",
                  "endTime": 1882.6879999833182,
                  "url": "https://www.google-analytics.com/r/collect?v=1&_v=j82&a=2017514527&t=pageview&_s=1&dl=https%3A%2F%2Fdevelopers.google.com%2F&dp=%2F&ul=en-us&de=UTF-8&dt=Google%20Developers&sd=24-bit&sr=800x600&vp=1350x940&je=0&_u=YHDAAAIh~&jid=1641092199&gjid=330891540&cid=1312010685.1590669061&tid=UA-24532603-1&_gid=644636400.1590669061&_r=1&cd6=en&cd4=Google%20Developers&cd5=en&cd3=0&cd1=Signed%20out&z=1043004991"
                },
                {
                  "url": "https://www.google-analytics.com/collect?v=1&_v=j82&a=2017514527&t=timing&_s=2&dl=https%3A%2F%2Fdevelopers.google.com%2F&dp=%2F&ul=en-us&de=UTF-8&dt=Google%20Developers&sd=24-bit&sr=800x600&vp=1350x940&je=0&utt=102.17000008560717&_u=aHDAAAIh~&jid=&gjid=&cid=1312010685.1590669061&tid=UA-24532603-1&_gid=644636400.1590669061&cd6=en&cd4=Google%20Developers&cd5=en&cd3=0&cd1=Signed%20out&z=1176788647",
                  "finished": true,
                  "resourceType": "Image",
                  "endTime": 1896.1480000289157,
                  "resourceSize": 35,
                  "statusCode": 200,
                  "transferSize": 644,
                  "startTime": 1890.6299999216571,
                  "mimeType": "image/gif"
                },
                {
                  "url": "https://www.google-analytics.com/collect?v=1&_v=j82&a=2017514527&t=timing&_s=3&dl=https%3A%2F%2Fdevelopers.google.com%2F&dp=%2F&ul=en-us&de=UTF-8&dt=Google%20Developers&sd=24-bit&sr=800x600&vp=1350x940&je=0&utt=118.78499994054437&_u=aHDAAAIh~&jid=&gjid=&cid=1312010685.1590669061&tid=UA-24532603-1&_gid=644636400.1590669061&cd6=en&cd4=Google%20Developers&cd5=en&cd3=0&cd1=Signed%20out&z=1054923137",
                  "mimeType": "image/gif",
                  "finished": true,
                  "transferSize": 643,
                  "endTime": 1917.8949999623,
                  "startTime": 1913.6329999892041,
                  "resourceSize": 35,
                  "resourceType": "Image",
                  "statusCode": 200
                },
                {
                  "resourceType": "Image",
                  "transferSize": 642,
                  "startTime": 1931.0389999300241,
                  "endTime": 1935.0979999871925,
                  "mimeType": "image/gif",
                  "url": "https://www.google-analytics.com/collect?v=1&_v=j82&a=2017514527&t=timing&_s=4&dl=https%3A%2F%2Fdevelopers.google.com%2F&dp=%2F&ul=en-us&de=UTF-8&dt=Google%20Developers&sd=24-bit&sr=800x600&vp=1350x940&je=0&utt=127.16999999247491&_u=aHDAAAIh~&jid=&gjid=&cid=1312010685.1590669061&tid=UA-24532603-1&_gid=644636400.1590669061&cd6=en&cd4=Google%20Developers&cd5=en&cd3=0&cd1=Signed%20out&z=373299005",
                  "finished": true,
                  "statusCode": 200,
                  "resourceSize": 35
                },
                {
                  "url": "https://www.google-analytics.com/collect?v=1&_v=j82&a=2017514527&t=timing&_s=5&dl=https%3A%2F%2Fdevelopers.google.com%2F&dp=%2F&ul=en-us&de=UTF-8&dt=Google%20Developers&sd=24-bit&sr=800x600&vp=1350x940&je=0&utt=1928.9799999678507&_u=aHDAAAIh~&jid=&gjid=&cid=1312010685.1590669061&tid=UA-24532603-1&_gid=644636400.1590669061&cd6=en&cd4=Google%20Developers&cd5=en&cd3=0&cd1=Signed%20out&z=862765953",
                  "transferSize": 643,
                  "startTime": 1953.5179999656975,
                  "mimeType": "image/gif",
                  "resourceSize": 35,
                  "statusCode": 200,
                  "finished": true,
                  "endTime": 1957.5310000218451,
                  "resourceType": "Image"
                },
                {
                  "transferSize": 821,
                  "resourceType": "Fetch",
                  "finished": true,
                  "url": "https://developers.google.com/_d/profile/user",
                  "endTime": 2255.0799999153242,
                  "startTime": 2100.5560000194237,
                  "mimeType": "application/json",
                  "resourceSize": 2,
                  "statusCode": 200
                }
              ],
              "headings": [{
                  "text": "URL",
                  "itemType": "url",
                  "key": "url"
                },
                {
                  "key": "startTime",
                  "granularity": 1,
                  "text": "Start Time",
                  "itemType": "ms"
                },
                {
                  "key": "endTime",
                  "granularity": 1,
                  "itemType": "ms",
                  "text": "End Time"
                },
                {
                  "itemType": "bytes",
                  "granularity": 1,
                  "displayUnit": "kb",
                  "text": "Transfer Size",
                  "key": "transferSize"
                },
                {
                  "text": "Resource Size",
                  "itemType": "bytes",
                  "key": "resourceSize",
                  "displayUnit": "kb",
                  "granularity": 1
                },
                {
                  "text": "Status Code",
                  "key": "statusCode",
                  "itemType": "text"
                },
                {
                  "text": "MIME Type",
                  "itemType": "text",
                  "key": "mimeType"
                },
                {
                  "text": "Resource Type",
                  "itemType": "text",
                  "key": "resourceType"
                }
              ],
              "type": "table"
            }
          },
          "unused-javascript": {
            "id": "unused-javascript",
            "title": "Remove unused JavaScript",
            "description": "Remove unused JavaScript to reduce bytes consumed by network activity. [Learn more](https://web.dev/remove-unused-code/).",
            "score": 0.87,
            "scoreDisplayMode": "numeric",
            "displayValue": "Potential savings of 148 KB",
            "details": {
              "type": "opportunity",
              "headings": [{
                  "valueType": "url",
                  "subRows": {
                    "valueType": "code",
                    "key": "sources"
                  },
                  "key": "url",
                  "label": "URL"
                },
                {
                  "key": "totalBytes",
                  "subRows": {
                    "key": "sourceBytes"
                  },
                  "valueType": "bytes",
                  "label": "Transfer Size"
                },
                {
                  "subRows": {
                    "key": "sourceWastedBytes"
                  },
                  "key": "wastedBytes",
                  "label": "Potential Savings",
                  "valueType": "bytes"
                }
              ],
              "overallSavingsMs": 160,
              "overallSavingsBytes": 151421,
              "items": [{
                  "wastedPercent": 68.984055149715019,
                  "wastedBytes": 77089,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/js/devsite_app.js",
                  "totalBytes": 111749
                },
                {
                  "totalBytes": 35385,
                  "wastedBytes": 26251,
                  "wastedPercent": 74.187078715370731,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/webcomponents-lite.js"
                },
                {
                  "wastedBytes": 11649,
                  "totalBytes": 16920,
                  "wastedPercent": 68.848244763791143,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_heading_link_module.js"
                },
                {
                  "wastedPercent": 62.950665108938487,
                  "totalBytes": 16444,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/app_loader.js",
                  "wastedBytes": 10352
                },
                {
                  "wastedPercent": 65.599173553719,
                  "wastedBytes": 10345,
                  "totalBytes": 15770,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_snackbar_module.js"
                },
                {
                  "wastedPercent": 64.050807873790575,
                  "totalBytes": 15272,
                  "wastedBytes": 9782,
                  "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/js/devsite_tooltip_module.js"
                },
                {
                  "totalBytes": 19103,
                  "wastedPercent": 31.1601150527325,
                  "url": "https://www.google-analytics.com/analytics.js",
                  "wastedBytes": 5953
                }
              ]
            },
            "numericValue": 160
          },
          "resource-summary": {
            "id": "resource-summary",
            "title": "Keep request counts low and transfer sizes small",
            "description": "To set budgets for the quantity and size of page resources, add a budget.json file. [Learn more](https://developers.google.com/web/tools/lighthouse/audits/budgets).",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "51 requests • 570 KB",
            "details": {
              "items": [{
                  "transferSize": 583850,
                  "resourceType": "total",
                  "requestCount": 51,
                  "label": "Total"
                },
                {
                  "resourceType": "script",
                  "requestCount": 8,
                  "transferSize": 232138,
                  "label": "Script"
                },
                {
                  "resourceType": "font",
                  "requestCount": 6,
                  "label": "Font",
                  "transferSize": 147292
                },
                {
                  "transferSize": 128328,
                  "resourceType": "image",
                  "requestCount": 28,
                  "label": "Image"
                },
                {
                  "resourceType": "stylesheet",
                  "transferSize": 60375,
                  "label": "Stylesheet",
                  "requestCount": 5
                },
                {
                  "label": "Document",
                  "requestCount": 1,
                  "transferSize": 12866,
                  "resourceType": "document"
                },
                {
                  "requestCount": 3,
                  "label": "Other",
                  "resourceType": "other",
                  "transferSize": 2851
                },
                {
                  "transferSize": 0,
                  "requestCount": 0,
                  "resourceType": "media",
                  "label": "Media"
                },
                {
                  "resourceType": "third-party",
                  "label": "Third-party",
                  "transferSize": 519523,
                  "requestCount": 41
                }
              ],
              "headings": [{
                  "key": "label",
                  "itemType": "text",
                  "text": "Resource Type"
                },
                {
                  "itemType": "numeric",
                  "text": "Requests",
                  "key": "requestCount"
                },
                {
                  "key": "transferSize",
                  "itemType": "bytes",
                  "text": "Transfer Size"
                }
              ],
              "type": "table"
            }
          },
          "dom-size": {
            "id": "dom-size",
            "title": "Avoids an excessive DOM size",
            "description": "A large DOM will increase memory usage, cause longer [style calculations](https://developers.google.com/web/fundamentals/performance/rendering/reduce-the-scope-and-complexity-of-style-calculations), and produce costly [layout reflows](https://developers.google.com/speed/articles/reflow). [Learn more](https://web.dev/dom-size).",
            "score": 0.9,
            "scoreDisplayMode": "numeric",
            "displayValue": "825 elements",
            "details": {
              "headings": [{
                  "key": "statistic",
                  "text": "Statistic",
                  "itemType": "text"
                },
                {
                  "text": "Element",
                  "key": "element",
                  "itemType": "code"
                },
                {
                  "text": "Value",
                  "itemType": "numeric",
                  "key": "value"
                }
              ],
              "items": [{
                  "statistic": "Total DOM Elements",
                  "value": "825"
                },
                {
                  "value": "19",
                  "statistic": "Maximum DOM Depth",
                  "element": {
                    "type": "code",
                    "value": "\u003cdiv class=\"devsite-nav-item-title\"\u003e"
                  }
                },
                {
                  "element": {
                    "value": "\u003cul class=\"devsite-nav-list\" menu=\"Products\" hidden=\"\"\u003e",
                    "type": "code"
                  },
                  "value": "23",
                  "statistic": "Maximum Child Elements"
                }
              ],
              "type": "table"
            },
            "numericValue": 825
          },
          "network-rtt": {
            "id": "network-rtt",
            "title": "Network Round Trip Times",
            "description": "Network round trip times (RTT) have a large impact on performance. If the RTT to an origin is high, it's an indication that servers closer to the user could improve performance. [Learn more](https://hpbn.co/primer-on-latency-and-bandwidth/).",
            "score": null,
            "scoreDisplayMode": "informative",
            "displayValue": "0 ms",
            "details": {
              "headings": [],
              "items": [],
              "type": "table"
            },
            "numericValue": 0
          },
          "unused-css-rules": {
            "id": "unused-css-rules",
            "title": "Remove unused CSS",
            "description": "Remove dead rules from stylesheets and defer the loading of CSS not used for above-the-fold content to reduce unnecessary bytes consumed by network activity. [Learn more](https://web.dev/unused-css-rules).",
            "score": 0.97,
            "scoreDisplayMode": "numeric",
            "displayValue": "Potential savings of 50 KB",
            "details": {
              "headings": [{
                  "label": "URL",
                  "key": "url",
                  "valueType": "url"
                },
                {
                  "valueType": "bytes",
                  "label": "Transfer Size",
                  "key": "totalBytes"
                },
                {
                  "valueType": "bytes",
                  "label": "Potential Savings",
                  "key": "wastedBytes"
                }
              ],
              "overallSavingsMs": 40,
              "type": "opportunity",
              "items": [{
                "wastedPercent": 93.507782262052814,
                "url": "https://www.gstatic.com/devrel-devsite/prod/v050cadc3f3cf927d4089880349cc4dea1a9dab3bc6036e7a65cc361fddd65555/developers/css/app.css",
                "wastedBytes": 50695,
                "totalBytes": 54215
              }],
              "overallSavingsBytes": 50695
            },
            "numericValue": 40
          }
        },
        "categories": {
          "performance": {
            "id": "performance",
            "title": "Performance",
            "score": 0.93,
            "auditRefs": [{
                "id": "first-contentful-paint",
                "weight": 15,
                "group": "metrics"
              },
              {
                "id": "speed-index",
                "weight": 15,
                "group": "metrics"
              },
              {
                "id": "largest-contentful-paint",
                "weight": 25,
                "group": "metrics"
              },
              {
                "id": "interactive",
                "weight": 15,
                "group": "metrics"
              },
              {
                "id": "total-blocking-time",
                "weight": 25,
                "group": "metrics"
              },
              {
                "id": "cumulative-layout-shift",
                "weight": 5,
                "group": "metrics"
              },
              {
                "id": "first-cpu-idle",
                "weight": 0
              },
              {
                "id": "max-potential-fid",
                "weight": 0
              },
              {
                "id": "first-meaningful-paint",
                "weight": 0
              },
              {
                "id": "estimated-input-latency",
                "weight": 0
              },
              {
                "id": "render-blocking-resources",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-responsive-images",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "offscreen-images",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "unminified-css",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "unminified-javascript",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "unused-css-rules",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "unused-javascript",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-optimized-images",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-webp-images",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-text-compression",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-rel-preconnect",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "server-response-time",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "redirects",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "uses-rel-preload",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "efficient-animated-content",
                "weight": 0,
                "group": "load-opportunities"
              },
              {
                "id": "total-byte-weight",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "uses-long-cache-ttl",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "dom-size",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "critical-request-chains",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "user-timings",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "bootup-time",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "mainthread-work-breakdown",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "font-display",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "performance-budget",
                "weight": 0,
                "group": "budgets"
              },
              {
                "id": "timing-budget",
                "weight": 0,
                "group": "budgets"
              },
              {
                "id": "resource-summary",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "third-party-summary",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "largest-contentful-paint-element",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "layout-shift-elements",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "uses-passive-event-listeners",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "no-document-write",
                "weight": 0,
                "group": "diagnostics"
              },
              {
                "id": "network-requests",
                "weight": 0
              },
              {
                "id": "network-rtt",
                "weight": 0
              },
              {
                "id": "network-server-latency",
                "weight": 0
              },
              {
                "id": "main-thread-tasks",
                "weight": 0
              },
              {
                "id": "diagnostics",
                "weight": 0
              },
              {
                "id": "metrics",
                "weight": 0
              },
              {
                "id": "screenshot-thumbnails",
                "weight": 0
              },
              {
                "id": "final-screenshot",
                "weight": 0
              }
            ]
          }
        },
        "categoryGroups": {
          "a11y-tables-lists": {
            "title": "Tables and lists",
            "description": "These are opportunities to to improve the experience of reading tabular or list data using assistive technology, like a screen reader."
          },
          "pwa-optimized": {
            "title": "PWA Optimized"
          },
          "seo-mobile": {
            "title": "Mobile Friendly",
            "description": "Make sure your pages are mobile friendly so users don’t have to pinch or zoom in order to read the content pages. [Learn more](https://developers.google.com/search/mobile-sites/)."
          },
          "best-practices-browser-compat": {
            "title": "Browser Compatibility"
          },
          "a11y-color-contrast": {
            "title": "Contrast",
            "description": "These are opportunities to improve the legibility of your content."
          },
          "diagnostics": {
            "title": "Diagnostics",
            "description": "More information about the performance of your application. These numbers don't [directly affect](https://web.dev/performance-scoring/) the Performance score."
          },
          "seo-content": {
            "title": "Content Best Practices",
            "description": "Format your HTML in a way that enables crawlers to better understand your app’s content."
          },
          "best-practices-general": {
            "title": "General"
          },
          "pwa-fast-reliable": {
            "title": "Fast and reliable"
          },
          "best-practices-trust-safety": {
            "title": "Trust and Safety"
          },
          "a11y-names-labels": {
            "title": "Names and labels",
            "description": "These are opportunities to improve the semantics of the controls in your application. This may enhance the experience for users of assistive technology, like a screen reader."
          },
          "a11y-language": {
            "title": "Internationalization and localization",
            "description": "These are opportunities to improve the interpretation of your content by users in different locales."
          },
          "metrics": {
            "title": "Metrics"
          },
          "best-practices-ux": {
            "title": "User Experience"
          },
          "a11y-best-practices": {
            "title": "Best practices",
            "description": "These items highlight common accessibility best practices."
          },
          "pwa-installable": {
            "title": "Installable"
          },
          "a11y-navigation": {
            "title": "Navigation",
            "description": "These are opportunities to improve keyboard navigation in your application."
          },
          "budgets": {
            "title": "Budgets",
            "description": "Performance budgets set standards for the performance of your site."
          },
          "a11y-aria": {
            "title": "ARIA",
            "description": "These are opportunities to improve the usage of ARIA in your application which may enhance the experience for users of assistive technology, like a screen reader."
          },
          "seo-crawl": {
            "title": "Crawling and Indexing",
            "description": "To appear in search results, crawlers need access to your app."
          },
          "a11y-audio-video": {
            "title": "Audio and video",
            "description": "These are opportunities to provide alternative content for audio and video. This may improve the experience for users with hearing or vision impairments."
          },
          "load-opportunities": {
            "title": "Opportunities",
            "description": "These suggestions can help your page load faster. They don't [directly affect](https://web.dev/performance-scoring/) the Performance score."
          }
        },
        "timing": {
          "total": 8171.35
        },
        "i18n": {
          "rendererFormattedStrings": {
            "varianceDisclaimer": "Values are estimated and may vary. The [performance score is calculated](https://web.dev/performance-scoring/) directly from these metrics.",
            "opportunityResourceColumnLabel": "Opportunity",
            "opportunitySavingsColumnLabel": "Estimated Savings",
            "errorMissingAuditInfo": "Report error: no audit information",
            "errorLabel": "Error!",
            "warningHeader": "Warnings: ",
            "auditGroupExpandTooltip": "Show audits",
            "passedAuditsGroupTitle": "Passed audits",
            "notApplicableAuditsGroupTitle": "Not applicable",
            "manualAuditsGroupTitle": "Additional items to manually check",
            "toplevelWarningsMessage": "There were issues affecting this run of Lighthouse:",
            "crcLongestDurationLabel": "Maximum critical path latency:",
            "crcInitialNavigation": "Initial Navigation",
            "lsPerformanceCategoryDescription": "[Lighthouse](https://developers.google.com/web/tools/lighthouse/) analysis of the current page on an emulated mobile network. Values are estimated and may vary.",
            "labDataTitle": "Lab Data"
          }
        }
      },
      "analysisUTCTimestamp": "2020-05-28T12:30:58.151Z"
    }
  }
}

module.exports = PSIGatherer;
