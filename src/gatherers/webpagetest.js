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
const setObject = require('../utils/set-object');
const Status = require('../common/status');
const {Metrics} = require('../common/metrics');
const Gatherer = require('./gatherer');

class WebPageTestGatherer extends Gatherer {
  constructor(config, envVars, apiHelper, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    envVars = envVars || {};

    this.runApiEndpoint = 'https://webpagetest.org/runtest.php';
    this.resultApiEndpoint = 'https://webpagetest.org/jsonResult.php';
    this.apiKey = envVars['webPageTestApiKey'];
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
      'lighthouse.FirstCPUIdle': 'data.median.firstView["lighthouse.Performance.first-cpu-idle"]',
      'lighthouse.TotalBlockingTime': 'data.lighthouse.audits["total-blocking-time"].numericValue',
      'lighthouse.LargestContentfulPaint': 'data.lighthouse.audits.metrics.details.items[0].largestContentfulPaint',
      'lighthouse.CumulativeLayoutShift' : 'data.median.firstView["chromeUserTiming.CumulativeLayoutShift"]',

      // Lighthouse resource size metrics
      'lighthouse.ThirdParty': 'data.lighthouse.audits["third-party-summary"].details.summary.wastedBytes',
      'lighthouse.RenderBlockingResources': 'data.lighthouse.audits["render-blocking-resources"].numericValue',
      'lighthouse.UnusedCSS': 'data.lighthouse.audits["unused-css-rules"].numericValue',
      'lighthouse.UseWebPImages': 'data.lighthouse.audits["uses-webp-images"].numericValue',
      'lighthouse.UseOptimizedImages': 'data.lighthouse.audits["uses-optimized-images"].numericValue',
      'lighthouse.OffscreenImages': 'data.lighthouse.audits["offscreen-images"].numericValue',
      'lighthouse.InstallableManifest': 'data.lighthouse.audits["installable-manifest"].numericValue',
      'lighthouse.ServiceWorker': 'data.lighthouse.audits["service-worker"].numericValue',
      'lighthouse.WorksOffline': 'data.lighthouse.audits["works-offline"].numericValue',

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
      'Requests': 'data.median.firstView.requestsDoc',
      'DOMElements': 'data.median.firstView.domElements',
      'Connections': 'data.median.firstView.connections',

      // WebPageTest Resource Size metrics
      'TotalSize': 'data.median.firstView.bytesIn',
      'CSS': 'data.median.firstView.breakdown.css.bytes',
      'Fonts': 'data.median.firstView.breakdown.font.bytes',
      'Javascript': 'data.median.firstView.breakdown.js.bytes',
      'Images': 'data.median.firstView.breakdown.image.bytes',
      'Videos': 'data.median.firstView.breakdown.video.bytes'
    };

    let bytesToKb = (x) => Math.round(x / 1000);
    this.metricsConversion = {
      'TotalSize': bytesToKb,
      'CSS': bytesToKb,
      'Fonts': bytesToKb,
      'Javascript': bytesToKb,
      'Images': bytesToKb,
      'Videos': bytesToKb,
      'ThirdParty': bytesToKb,
      'UnusedCSS': bytesToKb,
    };
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    assert(test.label, 'test.label is not defined.');
    options = options || {};

    let settings = test.webpagetest.settings;
    assert(settings, 'webpagetest.settings is not defined.');

    let location = `${settings.locationId}.${settings.connection}`;
    let params = {
      'label': encodeURIComponent(test.label),
      'url': encodeURIComponent(test.url),
      'k': this.apiKey,
      'f': 'json',
      'video': '1',
      'lighthouse': '1',
      'runs': settings.runs || '1',
      'fvonly': !settings.repeatView,
      'timeline': settings.hasTimeline || false,
      'block': settings.block || '',
      'script': settings.script || '',
      'location': location || '',
      'mobile': settings.device ? 1 : 0,
      'mobileDevice': settings.device || '',
    }

    let customParemeters = test.webpagetest.settings.customParameters;
    if (customParemeters) {
      customParemeters.split(',').forEach(element => {
        let obj = element.split("=");
        params[obj[0]] = obj[1];
      });
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

    let status, metadata = {}, errors = [], statusText = json.statusText;

    switch(json.statusCode) {
      case 100:
      case 101:
        status = Status.SUBMITTED;
        break;

      case 200:
        // Parse json resopnse and writes to metadata accordingly.
        let message;
        Object.keys(this.metadataMap).forEach(key => {
          try {
            let object = metadata;
            key.split('.').forEach(property => {
              object[property] = object[property] || {}
              object = object[property]
            });
            eval(`metadata.${key} = json.${this.metadataMap[key]}`);

          } catch (error) {
            metadata[key] = null;
            message = `Unable to assign ${key} to metadata: metadata.${key}` +
                ` = json.${this.metadataMap[key]}`;
            if (this.debug) message += e.message;
            errors.push(message);
          }
        });

        if (metadata.testId) {
          status = Status.SUBMITTED;
          setObject(test, 'webpagetest.metadata.lastTestId', metadata.testId);
        } else {
          // Throw error if there's no testId.
          status = Status.ERROR;
          statusText = 'No testId found';
        }

        if (errors.length > 0) {
          status = Status.ERROR;
          statusText = errors.join('\n');
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

    let status, metadata = {},
        metrics = new Metrics(), lighthouseMetrics = new Metrics();
    let statusText = json.statusText;
    let value, message;

    switch(json.statusCode) {
      case 100:
      case 101:
        status = Status.SUBMITTED;
        break;

      case 200:
        // Setting WebPageTest metrics.
        Object.keys(this.metricsMap).forEach(key => {
          // Using eval for the assigning to support non-string and non-numeric
          // value, like Date object.
          try {
            eval(`value = json.${this.metricsMap[key]};`);
            if (this.metricsConversion[key]) {
              value = this.metricsConversion[key](value);
            }

            // Note: Use setAny() instead of restrict metric names.
            metrics.setAny(key, value);
          } catch (e) {

            metrics.setAny(key, null);
            message = `Unable to assign json.${this.metricsMap[key]} to ${key}`;
            if (this.debug) message += ': ' + e.message;
            errors.push(message);
          }
        });

        status = Status.RETRIEVED;
        statusText = 'Success';
        if (errors.length > 0) {
          statusText = 'Success with errors: \n' + errors.join('\n');
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
      metrics: metrics.toObject() || {},
      errors: errors || [],
    };
  }

  async runBatch(tests, options) {
    return null;
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
