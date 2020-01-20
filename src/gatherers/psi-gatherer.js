'use strict';

const assert = require('assert');
const Status = require('../common/status');
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
      'testId': 'data.testId',
      'jsonUrl': 'data.jsonUrl',
      'ownerKey': 'data.ownerKey',
      'jsonUrl': 'data.jsonUrl',
      'xmlUrl': 'data.xmlUrl',
      'userUrl': 'data.userUrl',
      'summaryCSV': 'data.summaryCSV',
      'detailCSV': 'data.detailCSV',
    };

    this.metricsMap = {
      'FCP': 'lighthouse.audits[\'first-contentful-paint\'].displayValue',
      'FMP': 'lighthouse.audits[\'first-meaningful-paint\'].displayValue',
      'SpeedIndex': 'lighthouse.audits[\'speed-index\'].displayValue',
      'TTI': 'lighthouse.audits[\'interactive\'].displayValue',
      'FirstCPUIdle': 'lighthouse.audits[\'first-cpu-idle\'].displayValue',
      'FID': 'lighthouse.audits[\'estimated-input-latency\'].displayValue',
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};

    let params = {
      'url': encodeURIComponent(test.url),
      'key': this.apiKey,
    }

    let urlParams = [];
    Object.keys(params).forEach(key => {
      urlParams.push(key + '=' + params[key]);
    });
    let url = this.runApiEndpoint + '?' + urlParams.join('&');

    if (options.debug) console.log(url);

    try {
      let json = {};
      if (this.apiKey === 'TEST_API') {
        json = this.fakeJsonResponse();

      } else {
        let res = this.apiHelper.fetch(url);
        if (options.debug) console.log(url);

        let json = JSON.parse(res);
        if (options.debug) console.log(json);
      }

      if (json.statusCode === 200) {
        let metadata = {};
        Object.keys(this.metadataMap).forEach(key => {
          metadata[key] = eval('json.' + this.metadataMap[key]);
        });

        return {
          status: Status.SUBMITTED,
          settings: test.webpagetest.settings,
          metadata: metadata,
        }
      } else if (json.statusCode === 400) {
        return {
          status: Status.ERROR,
          statusText: json.statusText,
        };
      } else {
        throw new Error('Unknown error');
      }
    } catch (error) {
      console.error(error);
      return {
        status: Status.ERROR,
        statusText: error.toString(),
      };
    }
  }

  retrieve(resultData, options) {
    options = options || {};

    try {
      let urlParams = [
        'test=' + testId,
      ];
      let url = this.resultApiEndpoint + '?' + urlParams.join('&');
      if (options.debug) console.log(url);

      let res = this.apiHelper.fetch(url);
      let json = JSON.parse(res);

      if (json.statusCode === 200) {
        let metrics = {},
          metadata = {};
        Object.keys(this.metricsMap).forEach(key => {
          metrics[key] = eval('json.' + this.metricsMap[key]);
        });
        Object.keys(this.metadataMap).forEach(key => {
          metadata[key] = eval('json.' + this.metadataMap[key]);
        });
        return {
          status: Status.RETRIEVED,
          metadata: metadata,
          metrics: metrics,
        }
      } else if (json.statusCode === 400) {
        return {
          status: Status.ERROR,
          statusText: json.statusText,
        };
      } else {
        throw new Error('Unknown error');
      }
    } catch (error) {
      console.log(error);
      return {
        status: Status.ERROR,
        statusText: error.toString(),
      };
    }
  }

  fakeJsonResponse() {
    return {
      "captchaResult": "CAPTCHA_NOT_NEEDED",
      "kind": "pagespeedonline#result",
      "id": "https://developers.google.com/",
      "loadingExperience": {
        "id": "https://developers.google.com/",
        "metrics": {
          "FIRST_CONTENTFUL_PAINT_MS": {
            "percentile": 3482,
            "distributions": [{
                "min": 0,
                "max": 1000,
                "proportion": 0.37151728768042963
              },
              {
                "min": 1000,
                "max": 2500,
                "proportion": 0.4244153519077991
              },
              {
                "min": 2500,
                "proportion": 0.2040673604117713
              }
            ],
            "category": "SLOW"
          },
          "FIRST_INPUT_DELAY_MS": {
            "percentile": 36,
            "distributions": [{
                "min": 0,
                "max": 50,
                "proportion": 0.960628961482204
              },
              {
                "min": 50,
                "max": 250,
                "proportion": 0.02888834714773281
              },
              {
                "min": 250,
                "proportion": 0.010482691370063388
              }
            ],
            "category": "FAST"
          }
        },
        "overall_category": "SLOW",
        "initial_url": "https://developers.google.com/"
      },
      "originLoadingExperience": {
        "id": "https://developers.google.com",
        "metrics": {
          "FIRST_CONTENTFUL_PAINT_MS": {
            "percentile": 2761,
            "distributions": [{
                "min": 0,
                "max": 1000,
                "proportion": 0.4236433226493666
              },
              {
                "min": 1000,
                "max": 2500,
                "proportion": 0.45045120795679117
              },
              {
                "min": 2500,
                "proportion": 0.1259054693938423
              }
            ],
            "category": "SLOW"
          },
          "FIRST_INPUT_DELAY_MS": {
            "percentile": 45,
            "distributions": [{
                "min": 0,
                "max": 50,
                "proportion": 0.9537371485251699
              },
              {
                "min": 50,
                "max": 250,
                "proportion": 0.03044972719889055
              },
              {
                "min": 250,
                "proportion": 0.01581312427593959
              }
            ],
            "category": "FAST"
          }
        },
        "overall_category": "SLOW",
        "initial_url": "https://developers.google.com/"
      },
      "lighthouseResult": {
        "requestedUrl": "https://developers.google.com/",
        "finalUrl": "https://developers.google.com/",
        "lighthouseVersion": "3.2.0",
        "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/72.0.3584.0 Safari/537.36",
        "fetchTime": "2018-11-01T03:03:58.394Z",
        "environment": {
          "networkUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3559.0 Safari/537.36",
          "hostUserAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/72.0.3584.0 Safari/537.36",
          "benchmarkIndex": 590.0
        },
        "runWarnings": [],
        "configSettings": {
          "emulatedFormFactor": "desktop",
          "locale": "en-US",
          "onlyCategories": [
            "performance"
          ]
        },
        "audits": {
          "estimated-input-latency": {
            "id": "estimated-input-latency",
            "title": "Estimated Input Latency",
            "description": "The score above is an estimate of how long your app takes to respond to user input, in milliseconds, during the busiest 5s window of page load. If your latency is higher than 50 ms, users may perceive your app as laggy. [Learn more](https://developers.google.com/web/tools/lighthouse/audits/estimated-input-latency).",
            "score": 1.0,
            "scoreDisplayMode": "numeric",
            "displayValue": "30 ms"
          },
          "uses-rel-preconnect": {
            "id": "uses-rel-preconnect",
            "title": "Preconnect to required origins",
            "description": "Consider adding preconnect or dns-prefetch resource hints to establish early connections to important third-party origins. [Learn more](https://developers.google.com/web/fundamentals/performance/resource-prioritization#preconnect).",
            "score": 1.0,
            "scoreDisplayMode": "numeric",
            "details": {
              "headings": [],
              "type": "opportunity",
              "items": [],
              "overallSavingsMs": 0.0
            }
          },
        },
        "categories": {
          "performance": {
            "id": "performance",
            "title": "Performance",
            "score": 0.96,
            "auditRefs": [{
                "id": "first-contentful-paint",
                "weight": 3.0,
                "group": "metrics"
              },
              {
                "id": "first-meaningful-paint",
                "weight": 1.0,
                "group": "metrics"
              },
            ]
          }
        },
        "categoryGroups": {
          "a11y-element-names": {
            "title": "Elements Have Discernible Names",
            "description": "These are opportunities to improve the semantics of the controls in your application. This may enhance the experience for users of assistive technology, like a screen reader."
          },
          "a11y-language": {
            "title": "Page Specifies Valid Language",
            "description": "These are opportunities to improve the interpretation of your content by users in different locales."
          },
        },
        "i18n": {
          "rendererFormattedStrings": {
            "varianceDisclaimer": "Values are estimated and may vary.",
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
            "scorescaleLabel": "Score scale:",
            "crcLongestDurationLabel": "Maximum critical path latency:",
            "crcInitialNavigation": "Initial Navigation",
            "lsPerformanceCategoryDescription": "[Lighthouse](https://developers.google.com/web/tools/lighthouse/) analysis of the current page on an emulated mobile network. Values are estimated and may vary.",
            "labDataTitle": "Lab Data"
          }
        }
      },
      "analysisUTCTimestamp": "2018-11-01T03:03:58.394Z"
    };
  }

  module.exports = PSIGatherer;
