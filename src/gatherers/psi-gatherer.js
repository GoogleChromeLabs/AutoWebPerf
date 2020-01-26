'use strict';

const assert = require('../utils/assert');
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
      'testId': 'id',
      'requestedUrl': 'lighthouseResult.requestedUrl',
      'finalUrl': 'lighthouseResult.finalUrl',
      'lighthouseVersion': 'lighthouseResult.lighthouseVersion',
      'userAgent': 'lighthouseResult.userAgent',
      'fetchTime': 'lighthouseResult.fetchTime',
    };

    this.metricsMap = {
      'FirstPaint': 'lighthouseResult.audits.metrics.details.items[0].observedFirstPaint',
      'FCP': 'lighthouseResult.audits.metrics.details.items[0].observedFirstContentfulPaint',
      'FMP': 'lighthouseResult.audits.metrics.details.items[0].observedFirstMeaningfulPaint',
      'SpeedIndex': 'lighthouseResult.audits.metrics.details.items[0].observedSpeedIndex',
      'TTI': 'lighthouseResult.audits.metrics.details.items[0].interactive',
      'FirstCPUIdle': 'lighthouseResult.audits.metrics.details.items[0].firstCPUIdle',
      'FID': 'lighthouseResult.audits.metrics.details.items[0].estimatedInputLatency',
      'TBT': 'lighthouseResult.audits.metrics.details.items[0].totalBlockingTime',
      'LCP': 'lighthouseResult.audits.metrics.details.items[0].observedLargestContentfulPaintTs',
      'DCL': 'lighthouseResult.audits.metrics.details.items[0].observedDomContentLoaded',
      'onLoad': 'lighthouseResult.audits.metrics.details.items[0].observedLoad',
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};

    let settings = test.psi.settings;
    let params = {
      'url': encodeURIComponent(test.url),
      'key': this.apiKey,
      'category': 'performance',
      'locale': settings.locale,
      'strategy': settings.strategy,
    }
    let urlParams = [];
    Object.keys(params).forEach(key => {
      urlParams.push(key + '=' + params[key]);
    });

    console.log(settings);

    let url = this.runApiEndpoint + '?' + urlParams.join('&');

    if (options.debug) console.log(url);

    try {
      let json = {};
      if (this.apiKey === 'TEST_APIKEY') {
        json = this.fakeJsonResponse();

      } else {
        let res = this.apiHelper.fetch(url);
        json = JSON.parse(res);
      }

      if (json.lighthouseResult) {
        let metadata = {}, metrics = {};
        Object.keys(this.metadataMap).forEach(key => {
          metadata[key] = eval('json.' + this.metadataMap[key]);
        });
        Object.keys(this.metricsMap).forEach(key => {
          metrics[key] = eval('json.' + this.metricsMap[key]);
        });

        return {
          status: Status.RETRIEVED,
          settings: test.psi.settings,
          metadata: metadata,
          metrics: metrics,
        }
      } else {
        console.error(json);
        throw new Error('No Lighthouse result found.');
      }
    } catch (error) {
      console.error(error);
      return {
        status: Status.ERROR,
        statusText: error.toString(),
      };
    }
  }

  retrieve(resultObj, options) {
    return this.run(resultObj, options);
  }

  fakeJsonResponse() {
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
        },
      },
      "analysisUTCTimestamp": "2020-01-20T22:38:16.761Z"
    }
  }
}

module.exports = PSIGatherer;
