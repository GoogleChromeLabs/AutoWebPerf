'use strict';

const assert = require('../utils/assert');
const setObject = require('../utils/set-object');
const Status = require('../common/status');
const Metric = require('../common/metric');
const Gatherer = require('./gatherer');

class WebPageTestGatherer extends Gatherer {
  constructor(config, apiHelper, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.runApiEndpoint = 'https://webpagetest.org/runtest.php';
    this.resultApiEndpoint = 'https://webpagetest.org/jsonResult.php';
    this.apiKey = config.apiKey;
    this.apiHelper = apiHelper;

    options = options || {};
    this.debug = options.debug;

    // TODO: Metadata keys should be standardized.
    this.metadataMap = {
      'testId': 'data.testId',
      'ownerKey': 'data.ownerKey',
      'jsonUrl': 'data.jsonUrl',
      'xmlUrl': 'data.xmlUrl',
      'userUrl': 'data.userUrl',
      'summaryCSV': 'data.summaryCSV',
      'detailCSV': 'data.detailCSV',
    };

    this.metricsMap = {
      // Lighthouse Scores
      'lighthouse.Performance': 'data.median.firstView["lighthouse.Performance"]',
      'lighthouse.ProgressiveWebApp': 'data.median.firstView["lighthouse.ProgressiveWebApp"]',

      // Lighthouse timing metrics
      'lighthouse.FirstContentfulPaint': 'data.median.firstView["lighthouse.Performance.first-contentful-paint"]',
      'lighthouse.FirstMeaningfulPaint': 'data.median.firstView["lighthouse.Performance.first-meaningful-paint"]',
      'lighthouse.SpeedIndex': 'data.median.firstView["lighthouse.Performance.speed-index"]',
      'lighthouse.TimeToInteractive': 'data.median.firstView["lighthouse.Performance.interactive"]',
      'lighthouse.FirstInputDelay': 'data.median.firstView["lighthouse.Performance.max-potential-fid"]',
      'lighthouse.FirstCPUIdle': 'data.median.firstView["lighthouse.Performance.first-cpu-idle"]',
      'lighthouse.TotalBlockingTime': 'data.lighthouse.audits["total-blocking-time"].numbericValue',

      // WebPageTest Timing metrics
      'TimeToFirstByte': 'data.median.firstView.TTFB',
      'FirstPaint': 'data.median.firstView.render',
      'FirstContentfulPaint': 'data.median.firstView.firstContentfulPaint',
      'FirstMeaningfulPaint': 'data.median.firstView.firstMeaningfulPaint',
      'VisualComplete': 'data.median.firstView.visualComplete',
      'SpeedIndex': 'data.median.firstView.SpeedIndex',
      'LoadEvent': 'data.median.firstView.loadTime',
      'TimeToInteractive': 'data.median.firstView.TTIMeasurementEnd',
      'DOMContentLoaded': 'data.median.firstView.domContentLoadedEventStart',

      // WebPageTest Resource Count metrics
      // 'BytesIn': 'data.median.firstView.bytesIn',
      'Requests': 'data.median.firstView.requestsDoc',
      'DOMElements': 'data.median.firstView.domElements',
      'Connections': 'data.median.firstView.connections',

      // WebPageTest Resource Size metrics
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
      'location': `${settings.locationId}.${settings.connection}` || '',
      'mobile': settings.mobile || '',
    }

    let urlParams = [];
    Object.keys(params).forEach(key => {
      urlParams.push(key + '=' + params[key]);
    });
    let url = this.runApiEndpoint + '?' + urlParams.join('&');
    if (this.debug) console.log('WPTGatherer::run\n', url);

    let json = {};
    if (this.apiKey === 'TEST_APIKEY') {
      json = this.fakeRunResponse();
    } else {
      let res = this.apiHelper.fetch(url);
      json = JSON.parse(res);
      if (this.debug) console.log('WPTGatherer::run API response: \n', json);
    }

    let status, metadata = {}, errors = [];

    switch(json.statusCode) {
      case 100:
        status = Status.SUBMITTED;
        break;

      case 200:
        // Parse json resopnse and writes to metadata accordingly.
        Object.keys(this.metadataMap).forEach(key => {
          try {
            let object = metadata;
            key.split('.').forEach(property => {
              object[property] = object[property] || {}
              object = object[property]
            });
            eval(`metadata.${key} = json.${this.metadataMap[key]}`);
          } catch (error) {
            errors.push(`Unable to assign ${key} to metadata: metadata.${key} = json.${this.metadataMap[key]}`);
            metadata[key] = null;
          }
        });

        if (metadata.testId) {
          status = Status.SUBMITTED;
          setObject(test, 'webpagetest.metadata.lastTestId', metadata.testId);
        } else {
          // Throw error if there's no testId.
          status = Status.ERROR;
        }
        break;

      case 400:
      default:
        status = Status.ERROR;
        break;
    }

    return {
      status: status,
      statusText: json.statusText,
      settings: settings,
      metadata: metadata,
      errors: errors || [],
    };
  }

  retrieve(result, options) {
    options = options || {};
    let errors = [];
    let gathererData = result.webpagetest;
    let urlParams = [
      'test=' + gathererData.metadata.testId,
    ];
    let url = this.resultApiEndpoint + '?' + urlParams.join('&');
    if (this.debug) console.log('WPTGatherer::retrieve\n', url);

    let res = this.apiHelper.fetch(url);
    let json = JSON.parse(res);
    if (this.debug) console.log(
        'WPTGatherer::retrieve json.statusCode=\n', json.statusCode);
    if (this.debug) console.log('WPTGatherer::retrieve\n', json);

    let status, metrics = {}, metadata = {};
    let statusText = json.statusText;

    switch(json.statusCode) {
      case 100:
        status = Status.SUBMITTED;
        break;

      case 200:
        Object.keys(this.metricsMap).forEach(key => {
          try {
            let object = metrics;
            key.split('.').forEach(property => {
              object[property] = object[property] || {}
              object = object[property]
            });
            eval(`metrics.${key} = json.${this.metricsMap[key]}`);
          } catch (error) {
            errors.push(`Unable to assign ${key} to metrics.`);
            metrics[key] = null;
          }
        });
        if (errors.length > 0) {
          status = Status.ERROR;
        } else {
          status = Status.RETRIEVED;
          statusText = 'Success';
        }
        break;

      case 400:
        status = Status.ERROR;
        // Deal with the occasional error with "Test not found". These type of
        // tests can be resolved by simply retrying.
        if (json.statusText === 'Test not found') {
          status = Status.SUBMITTED;
        }
        break;

      default:
        status = Status.ERROR;
        break;
    }

    return {
      status: status,
      statusText: statusText,
      settings: gathererData.settings,
      metadata: gathererData.metadata,
      metrics: metrics || {},
      errors: errors || [],
    };
  }

  fakeRunResponse() {
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
