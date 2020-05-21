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
const Gatherer = require('./gatherer');
const {Metrics} = require('../common/metrics');
const {BigQueryHandler} = require('../helpers/gcp-handler');

class ChromeUXReportGatherer extends Gatherer {
  constructor(config, envVars, apiHelper, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.gcpProjectId = envVars.gcpProjectId;
    this.keyFilename = envVars.gcpKeyFilePath;

    this.bigQueryHandler = new BigQueryHandler({
      projectId: this.gcpProjectId,
      keyFilename: this.keyFilename
    });
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
  }

  retrieve(result, options) {
		assert(result, 'Parameter result is missing.');
  }

	async runBatch(tests, options) {
		assert(tests, 'Parameter tests is missing.');


    console.log('gcpProjectId', this.gcpProjectId);

    var originsArray = [];
    var originsString = "";

    if(tests.length) {
      tests.forEach(test => {
        originsArray.push(test.chromeuxreport.origin);
        originsString += "\"" + test.chromeuxreport.origin + "\", ";
      });
      originsString = originsString.substring(0,originsString.length-2);


      let query = this.deviceQuery(originsString);

      //console.log('query', query);
      let rows = await this.bigQueryHandler.query(query);
      
      console.log('rows', rows);

      return rows;

      /*
      return tests.map(test => {
        return {
          status: Status.RETRIEVED,
          origin: test.url,
          metrics: fakeMetrics[test.url] || fakeMetrics['web.dev'],
        }
      });
      */
    }
      
    return null;
	}

	retrieveBatch(results, options) {
	}

	/**
	 * Return a fake response object for testing purpose.
	 * @return {object} Response object.
	 */
	fakeResponses(tests) {
    // Notes of the returned object:
    // The length of the overall response matches the given Tests's length,
    // which means the number of origins. The individual metrics contains the
    // list of CrUX metrics for each origin.

    let fakeMetrics = {
      'example.com': [{
        YearMonth: '202004',
        Device: 'phone',
        DesktopDensity : 0.2,
        PhoneDensity : 0.75,
        TabletDensity: 0.05,
        EffectiveConnectionType: {
          '4GDensity': 0.90,
          '3gDensity': 0.90,
          '2gDensity': 0.10,
          'slow2GDensity': 0.00,
          'offlineDensity': 0.00
        },
        NotificatonPermission: {
          'acceptDensity': 0.2,
          'ignoreDensity': 0.2,
          'denyDensity': 0.3,
          'blockDensity': 0.3,
        },
        TimeToFirstByte: {
          p75: 500,
          slowDensity: 0.2,
          averageDensity: 0.2,
          fastDensity: 0.6,
        },
        FirstPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        FirstContentfulPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        LargestContentfulPaint: {
          p75: 1900,
          slowDensity: 0.1,
          averageDensity: 0.2,
          fastDensity: 0.7,
        },
        CumulativeLayoutShift: {
          p75: 0.05,
          slowDensity: 0.15,
          averageDensity: 0.15,
          fastDensity: 0.8,
        },
        FirstInputDelay: {
          p75: 25,
          slowDensity: 0.25,
          averageDensity: 0.25,
          fastDensity: 0.95,
        },
        DOMContentLoaded: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.80,
        },
        OnLoad: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }],
      'web.dev': [{
        YearMonth: '202005',
        DesktopDensity : 0.2,
        PhoneDensity : 0.75,
        TabletDensity: 0.05,
        EffectiveConnectionType: {
          '4GDensity': 0.90,
          '3gDensity': 0.90,
          '2gDensity': 0.10,
          'slow2GDensity': 0.00,
          'offlineDensity': 0.00,
        },
        NotificatonPermission: {
          'acceptDensity': 0.2,
          'ignoreDensity': 0.2,
          'denyDensity': 0.3,
          'blockDensity': 0.3,
        },
        TimeToFirstByte: {
          p75: 500,
          slowDensity: 0.2,
          averageDensity: 0.2,
          fastDensity: 0.6,
        },
        FirstPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        FirstContentfulPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        LargestContentfulPaint: {
          p75: 1900,
          slowDensity: 0.1,
          averageDensity: 0.2,
          fastDensity: 0.7,
        },
        CumulativeLayoutShift: {
          p75: 0.05,
          slowDensity: 0.15,
          averageDensity: 0.15,
          fastDensity: 0.8,
        },
        FirstInputDelay: {
          p75: 25,
          slowDensity: 0.25,
          averageDensity: 0.25,
          fastDensity: 0.95,
        },
        DOMContentLoaded: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.80,
        },
        OnLoad: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }, {
        YearMonth: '202004',
        DesktopDensity : 0.2,
        PhoneDensity : 0.75,
        TabletDensity: 0.05,
        EffectiveConnectionType: {
          '4GDensity': 0.90,
          '3gDensity': 0.90,
          '2gDensity': 0.10,
          'slow2GDensity': 0.00,
          'offlineDensity': 0.00,
        },
        NotificatonPermission: {
          'acceptDensity': 0.2,
          'ignoreDensity': 0.2,
          'denyDensity': 0.3,
          'blockDensity': 0.3,
        },
        TimeToFirstByte: {
          p75: 500,
          slowDensity: 0.2,
          averageDensity: 0.2,
          fastDensity: 0.6,
        },
        FirstPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        FirstContentfulPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
        LargestContentfulPaint: {
          p75: 1900,
          slowDensity: 0.1,
          averageDensity: 0.2,
          fastDensity: 0.7,
        },
        CumulativeLayoutShift: {
          p75: 0.05,
          slowDensity: 0.15,
          averageDensity: 0.15,
          fastDensity: 0.8,
        },
        FirstInputDelay: {
          p75: 25,
          slowDensity: 0.25,
          averageDensity: 0.25,
          fastDensity: 0.95,
        },
        DOMContentLoaded: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.80,
        },
        OnLoad: {
          p75: 2000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }],
    }

    return tests.map(test => {
      return {
        status: Status.RETRIEVED,
        origin: test.url,
  			metrics: fakeMetrics[test.url] || fakeMetrics['web.dev'],
      }
    });
  }

  deviceQuery(origins) {
    let query = `SELECT
          yyyymm as Date,
          Origin,
          Device,
          p75_ttfb,
          p75_fp,
          p75_fcp,
          p75_lcp,
          p75_fid,
          p75_cls,
          p75_dcl,
          p75_ol,
          IF(fast_fp>0, fast_fp /(fast_fp + avg_fp + slow_fp), null) AS fast_fp,
          IF(avg_fp>0, avg_fp / (fast_fp + avg_fp + slow_fp), null) AS avg_fp,
          IF(slow_fp>0, slow_fp / (fast_fp + avg_fp + slow_fp), null) AS slow_fp,
          IF(fast_fcp>0, fast_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS fast_fcp,
          IF(avg_fcp>0, avg_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS avg_fcp,
          IF(slow_fcp>0, slow_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS slow_fcp,
          IF(fast_lcp>0, fast_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS fast_lcp,
          IF(avg_lcp>0, avg_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS avg_lcp,
          IF(slow_lcp>0, slow_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS slow_lcp,
          IF(fast_fid>0, fast_fid / (fast_fid + avg_fid + slow_fid), null) AS fast_fid,
          IF(avg_fid>0, avg_fid / (fast_fid + avg_fid + slow_fid), null) AS avg_fid,
          IF(slow_fid>0, slow_fid / (fast_fid + avg_fid + slow_fid), null) AS slow_fid,
          IF(fast_dcl>0, fast_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS fast_dcl,
          IF(avg_dcl>0, avg_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS avg_dcl,
          IF(slow_dcl>0, slow_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS slow_dcl,
          IF(fast_ol>0, fast_ol / (fast_ol + avg_ol + slow_ol), null) AS fast_ol,
          IF(avg_ol>0, avg_ol / (fast_ol + avg_ol + slow_ol), null) AS avg_ol,
          IF(slow_ol>0, slow_ol / (fast_ol + avg_ol + slow_ol), null) AS slow_ol,
          IF(fast_ttfb>0, fast_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS fast_ttfb,
          IF(avg_ttfb>0, avg_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS avg_ttfb,
          IF(slow_ttfb>0, slow_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS slow_ttfb,
          IF(small_cls>0, small_cls / (small_cls + medium_cls + large_cls), null) AS small_cls,
          IF(medium_cls>0, medium_cls / (small_cls + medium_cls + large_cls), null) AS medium_cls,
          IF(large_cls>0, large_cls / (small_cls + medium_cls + large_cls), null) AS large_cls,
          desktopDensity,
          phoneDensity,
          tabletDensity,
          _4GDensity,
          _3GDensity,
          _2GDensity,
          slow2GDensity,
          offlineDensity,
          notification_permission_accept,
          notification_permission_deny,
          notification_permission_ignore,
          notification_permission_dismiss
           FROM
             \`chrome-ux-report.materialized.device_summary\`
           WHERE
             origin IN (` + origins + `)
           ORDER BY
             Origin,
             Date;`

    return query;
  }

}

module.exports = ChromeUXReportGatherer;
