'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const Gatherer = require('./gatherer');

class WebPageTestGatherer extends Gatherer {
  constructor(config, apiHelper) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.runApiEndpoint = 'https://webpagetest.org/runtest.php';
    this.resultApiEndpoint = 'https://webpagetest.org/jsonResult.php';
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
      'lighthouse.Performance': 'data.median.firstView[\'lighthouse.Performance\']',
      'lighthouse.PWA': 'data.median.firstView[\'lighthouse.ProgressiveWebApp\']',
      'lighthouse.FCP': 'data.median.firstView[\'lighthouse.Performance.first-contentful-paint\']',
      'lighthouse.FMP': 'data.median.firstView[\'lighthouse.Performance.first-meaningful-paint\']',
      'lighthouse.SpeedIndex': 'data.median.firstView[\'lighthouse.Performance.speed-index\']',
      'lighthouse.TTI': 'data.median.firstView[\'lighthouse.Performance.interactive\']',
      'lighthouse.FID': 'data.median.firstView[\'lighthouse.Performance.max-potential-fid\']',
      'lighthouse.FirstCPUIdle': 'data.median.firstView[\'lighthouse.Performance.first-cpu-idle\']',
      'lighthouse.TBT': 'data.lighthouse.total-blocking-time.numbericValue',

      'TTFB': 'data.median.firstView.TTFB',
      'FirstPaint': 'data.median.firstView.render',
      'FCP': 'data.median.firstView.firstContentfulPaint',
      'FMP': 'data.median.firstView.firstMeaningfulPaint',
      'VisualComplete': 'data.median.firstView.visualComplete',
      'SpeedIndex': 'data.median.firstView.SpeedIndex',
      'TTI': 'data.median.firstView.TTIMeasurementEnd',
      'onLoad': 'data.median.firstView.loadTime',
      'Requests': 'data.median.firstView.requestsDoc',
      'DCL': 'data.median.firstView.domContentLoadedEventStart',
      'Bytes': 'data.median.firstView.bytesIn',
      'DOMElements': 'data.median.firstView.domElements',

      'CSS': 'data.median.firstView.breakdown.css.bytes',
      'Fonts': 'data.median.firstView.breakdown.font.bytes',
      'Javascript': 'data.median.firstView.breakdown.js.bytes',
      'Images': 'data.median.firstView.breakdown.image.bytes',
      'Videos': 'data.median.firstView.breakdown.video.bytes'
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};

    let settings = test.webpagetest.settings;
    let params = {
      'label': encodeURIComponent(test.label),
      'url': encodeURIComponent(test.url),
      'k': this.apiKey,
      'f': 'json',
      'video': '1',
      'lighthouse': '1',
      'runs': settings.runs || '1',
      'fvonly': !settings.repeatView || true,
      'timeline': settings.hasTimeline || false,
      'block': settings.block || '',
      'script': settings.script || '',
    }

    let urlParams = [];
    Object.keys(params).forEach(key => {
      urlParams.push(key + '=' + params[key]);
    });
    let url = this.runApiEndpoint + '?' + urlParams.join('&');

    if (options.debug) console.log(url);

    try {
      let json = {};
      if (this.apiKey === 'TEST_APIKEY') {
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

  retrieve(resultObj, options) {
    options = options || {};

    let gathererData = resultObj.webpagetest;

    try {
      let urlParams = [
        'test=' + gathererData.metadata.testId,
      ];
      let url = this.resultApiEndpoint + '?' + urlParams.join('&');
      if (options.debug) console.log(url);

      let res = this.apiHelper.fetch(url);
      let json = JSON.parse(res);

      if (json.statusCode === 200) {
        let metrics = {}, metadata = {};
        Object.keys(this.metricsMap).forEach(key => {
          metrics[key] = eval('json.' + this.metricsMap[key]);
        });
        return {
          status: Status.RETRIEVED,
          metadata: gathererData.metadata,
          settings: gathererData.settings,
          metrics: metrics,
        }
      } else if (json.statusCode === 400) {
        return {
          status: Status.ERROR,
          statusText: json.statusText,
          metadata: gathererData.metadata,
          settings: gathererData.settings,
        };
      } else {
        throw new Error('Unknown error');
      }
    } catch (error) {
      console.log(error);
      return {
        status: Status.ERROR,
        statusText: error.toString(),
        metadata: gathererData.metadata,
        settings: gathererData.settings,
      };
    }
  }

  fakeJsonResponse() {
    return {
      statusCode: 200,
      statusText: 'Ok',
      data: {
        testId: '200118_KA_4022ee20eaf1deebb393585731de6576',
        ownerKey: '9c58809d442152143c04bb7f1a711224aac3cfde',
        jsonUrl: 'https://webpagetest.org/jsonResult.php?test=200118_KA_4022ee20eaf1deebb393585731de6576',
        xmlUrl: 'https://webpagetest.org/xmlResult/200118_KA_4022ee20eaf1deebb393585731de6576/',
        userUrl: 'https://webpagetest.org/result/200118_KA_4022ee20eaf1deebb393585731de6576/',
        summaryCSV: 'https://webpagetest.org/result/200118_KA_4022ee20eaf1deebb393585731de6576/page_data.csv',
        detailCSV: 'https://webpagetest.org/result/200118_KA_4022ee20eaf1deebb393585731de6576/requests.csv'
      }
    };
  }
}

module.exports = WebPageTestGatherer;
