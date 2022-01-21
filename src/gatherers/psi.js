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
  constructor(config, envVars, apiHandler) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(envVars, 'Parameter apiHandler is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.runApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.resultApiEndpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    this.apiKey = envVars.PSI_APIKEY || envVars.psiApiKey;
    this.apiHandler = apiHandler;

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
      'lighthouse.WebPImages': 'lighthouseResult.audits["modern-image-formats"].details.overallSavingsBytes',
      'lighthouse.OptimizedImages': 'lighthouseResult.audits["uses-optimized-images"].details.overallSavingsBytes',
      'lighthouse.ResponsiveImages': 'lighthouseResult.audits["uses-responsive-images"].details.overallSavingsBytes',
      'lighthouse.OffscreenImages': 'lighthouseResult.audits["offscreen-images"].details.overallSavingsBytes',
      'lighthouse.DOMElements': 'lighthouseResult.audits["dom-size"].numericValue',
      'lighthouse.Requests': 'lighthouseResult.audits["network-requests"].details.numericValue',
      'lighthouse.Performance': 'lighthouseResult.categories.performance.score',
      'lighthouse.ProgressiveWebApp': 'lighthouseResult.categories.pwa.score',
      'lighthouse.Manifest': 'lighthouseResult.audits["installable-manifest"].score',
      'lighthouse.ServiceWorker': 'lighthouseResult.audits["service-worker"].score',
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
    let psiConfig = test.psi || {};
    let settings = psiConfig.settings || {};
    let params = {
      'url': encodeURIComponent(test.url),
      'key': this.apiKey || '',
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
        response = this.apiHandler.fetch(url);
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
          let detailedItems = (blockingResources.details || {}).items || [];
          detailedItems.forEach((br) => {
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
        settings: settings,
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
    if (dataSource === 'crux' && json.loadingExperience) {
      let processedLoadingExperience = {};
      let expMetrics = json.loadingExperience.metrics || {};
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
    return require('../../test/fakedata/psi-response.json');
  }
}

module.exports = PSIGatherer;
