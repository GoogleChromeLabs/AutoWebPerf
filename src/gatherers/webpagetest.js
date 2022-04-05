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

const PUBLIC_ENDPOINT = 'https://webpagetest.org';
const PUBLIC_RUN_ENDPOINT = 'https://webpagetest.org/runtest.php';
const PUBLIC_RESULT_ENDPOINT = 'https://webpagetest.org/jsonResult.php';

class WebPageTestGatherer extends Gatherer {
  constructor(config, envVars, apiHandler, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    envVars = envVars || {};
    options = options || {};
    this.apiHandler = apiHandler;
    this.debug = options.debug;

    // Get endpoints for run and result actions. Override these endpoints when
    // custom endpoints are defined.
    let customApiEndpoint = envVars.webPageTestApiEndpoint;
    this.runApiEndpoint = (customApiEndpoint || PUBLIC_ENDPOINT) +
        '/runtest.php';
    this.resultApiEndpoint = (customApiEndpoint || PUBLIC_ENDPOINT) +
        '/jsonResult.php';
    this.runApiEndpoint = config.runApiEndpoint || this.runApiEndpoint;
    this.resultApiEndpoint = config.resultApiEndpiont || this.resultApiEndpoint;

    if (this.debug && customApiEndpoint) {
      console.log(`Using custom WebPageTest API Endpoint: ` +
          `${customApiEndpoint}`);
    }

    // Get mandatory API key from environmental variables.
    this.apiKey = envVars.WPT_APIKEY || envVars.wptAPiKey ||
        envVars.webPageTestApiKey;
    assert(this.apiKey, 'Unable to locate "WPT_APIKEY" or "webPageTestApiKey" in envVars');

    if (this.debug) {
      console.log('Using API Key: ' + this.apiKey);
    }

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
      'LargestContentfulPaint': 'data.median.firstView["chromeUserTiming.LargestContentfulPaint"]',
      'CumulativeLayoutShift': 'data.median.firstView["chromeUserTiming.CumulativeLayoutShift"]',
      'TotalBlockingTime': 'data.median.firstView.TotalBlockingTime',
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
    assert(test.url, 'Parameter test.url is missing.');
    options = options || {};

    let wptConfig = test.webpagetest || {};
    let settings = wptConfig.settings || {};
    let locationId = settings.locationId || 'ec2-us-east-1';
    let connection = settings.connection || '4G';

    let location = `${locationId}.${connection}`;
    let params = {
      'label': encodeURIComponent(test.label || test.url),
      'url': encodeURIComponent(test.url),
      'k': this.apiKey,
      'f': 'json',
      'video': '1',
      'lighthouse': '1',
      'runs': settings.runs || '1',
      'fvonly': settings.repeatView ? 0 : 1,
      'timeline': settings.hasTimeline || false,
      'block': settings.block || '',
      'script': settings.script ? encodeURIComponent(settings.script) : '',
      'location': location || '',
      'mobile': settings.device ? 1 : 0,
      'mobileDevice': settings.device || '',
    }

    let customParemeters = settings.customParameters;
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

    let response, body = {}, statusText;
    if (this.apiKey === 'TEST_APIKEY') {
      if (this.debug) {
        console.log('Using fake WPT response.');
      }

      response = this.fakeRunResponse();
      body = response.body || {};
      statusText = body.statusText;

    } else {
      if (this.debug) console.log('WPTGatherer::run\n', url);
      response = this.apiHandler.fetch(url);

      if (this.debug) {
        console.log('WPTGatherer::run API response: \n', response);
      }

      if (response.statusCode >= 400) {
        return {
          status: Status.ERROR,
          statusText: response.statusText,
          settings: wptConfig.settings,
          metadata: wptConfig.metadata,
          errors: [response.statusText],
        };
      }

      body = JSON.parse(response.body || '{}');
      statusText = body.statusText;
    }

    let status, metadata = {}, errors = [];

    try {
      switch(body.statusCode) {
        case 100:
        case 101:
          status = Status.SUBMITTED;
          break;

        case 200:
          // Parse body resopnse and writes to metadata accordingly.
          let message;
          Object.keys(this.metadataMap).forEach(key => {
            try {
              let object = metadata;
              key.split('.').forEach(property => {
                object[property] = object[property] || {}
                object = object[property]
              });
              eval(`metadata.${key} = body.${this.metadataMap[key]}`);

            } catch (error) {
              metadata[key] = null;
              message = `Unable to assign ${key} to metadata: metadata.${key}` +
                  ` = body.${this.metadataMap[key]}`;
              if (this.debug) console.error(message);
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
          }

          break;

        default:
        case 400:
          status = Status.ERROR;
          // Deal with the occasional error with "Test not found". These type of
          // tests can be resolved by simply retrying.
          if (statusText === 'Test not found') {
            statusText = `Test not found. If this happends consistently, try ` +
                `${result.webpagetest.metadata.userUrl} to bring Test back to ` +
                `active.`;
          }
          errors.push(statusText);
          break;
      }

    } catch (e) {
      if (this.debug) console.error(e);

      status = Status.ERROR;
      statusText = e.message;
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
    let wptConfig = result.webpagetest || {};
    let urlParams = [
      'test=' + wptConfig.metadata.testId,
    ];
    let url = this.resultApiEndpoint + '?' + urlParams.join('&');
    if (this.debug) console.log('WPTGatherer::retrieve\n', url);

    let response = this.apiHandler.fetch(url);

    if (response.statusCode >= 400) {
      return {
        status: Status.ERROR,
        statusText: response.statusText,
        settings: wptConfig.settings,
        metadata: wptConfig.metadata,
        metrics: {},
        errors: [response.statusText],
      };
    }

    let body = JSON.parse(response.body);

    if (this.debug) console.log(
        'WPTGatherer::retrieve body.statusCode=\n', body.statusCode);
    if (this.debug) console.log('WPTGatherer::retrieve\n', body);

    let status, metadata = {},
        metrics = new Metrics(), lighthouseMetrics = new Metrics();
    let statusText = body.statusText;
    let value, message;

    switch(body.statusCode) {
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
            eval(`value = body.${this.metricsMap[key]};`);
            if (this.metricsConversion[key]) {
              value = this.metricsConversion[key](value);
            }

            // Note: Use setAny() instead of restrict metric names.
            metrics.setAny(key, value);
          } catch (e) {

            metrics.setAny(key, null);
            message = `Unable to assign body.${this.metricsMap[key]} to ${key}`;
            if (this.debug) message += ': ' + e.message;
            errors.push(message);
          }
        });

        status = Status.RETRIEVED;
        statusText = 'Success';
        if (errors.length > 0) {
          statusText = 'Success with errors';
        }
        break;

      case 400:
        status = Status.ERROR;
        // Deal with the occasional error with "Test not found". These type of
        // tests can be resolved by simply retrying.
        if (statusText === 'Test not found') {
          statusText = `Test not found. If this happends consistently, try ` +
              `${result.webpagetest.metadata.userUrl} to bring Test back to ` +
              `active.`;
        }
        errors.push(statusText);
        break;

      case 500:
        status = Status.ERROR;
        // Deal with the occasional error with "Test not found". These type of
        // tests can be resolved by simply retrying.
        if (statusText === 'Unavailable Service') {
          status = Status.SUBMITTED;
        }
        errors.push(statusText);
        break;

      default:
        status = Status.ERROR;
        break;
    }

    return {
      status: status,
      statusText: statusText,
      settings: wptConfig.settings,
      metadata: wptConfig.metadata,
      metrics: metrics.toObject() || {},
      errors: errors || [],
    };
  }

  fakeRunResponse() {
    return {
      statusCode: 200,
      body: {
        statusCode: 200,
        statusText: 'Ok',
        data: {
          testId: '200601_X6_efeb625266aacabaece9ffe9d4bcd207',
          jsonUrl: 'https://webpagetest.org/jsonResult.php?test=200601_X6_efeb625266aacabaece9ffe9d4bcd207',
          xmlUrl: 'https://webpagetest.org/xmlResult/200601_X6_efeb625266aacabaece9ffe9d4bcd207/',
          userUrl: 'https://webpagetest.org/result/200601_X6_efeb625266aacabaece9ffe9d4bcd207/',
          summaryCSV: 'https://webpagetest.org/result/200601_X6_efeb625266aacabaece9ffe9d4bcd207/page_data.csv',
          detailCSV: 'https://webpagetest.org/result/200601_X6_efeb625266aacabaece9ffe9d4bcd207/requests.csv'
        }
      },
    };
  }
}

module.exports = WebPageTestGatherer;
