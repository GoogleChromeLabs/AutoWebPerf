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

class CrUXBigQueryGatherer extends Gatherer {
  constructor(config, envVars, apiHandler, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHandler, 'Parameter apiHandler is missing.');

    this.gcpProjectId = envVars.GCP_PROJECT_ID || envVars.gcpProjectId;
    this.keyFilename = envVars.SERVICE_ACCOUNT_CREDENTIALS || envVars.GCP_KEYFILE_PATH || envVars.gcpKeyFilePath;

    assert(this.gcpProjectId, 'gcpProjectId is not defined in Environment ' +
        'Variables');
    this.bigQueryHandler = new BigQueryHandler({
      platform: config.platform || 'Node',
      projectId: this.gcpProjectId,
      keyFilename: this.keyFilename
    });
  }

  run(test, options) {
    throw new Error('Please use runByBatch mode for CrUXBigQueryGatherer');
  }

  retrieve(result, options) {
    throw new Error('Please use runByBatch mode for CrUXBigQueryGatherer');
  }

	async runBatchAsync(tests, options) {
		assert(tests, 'Parameter tests is missing.');

    let originsArray = [];
    let originsString = '';

    if (tests.length) {
      tests.forEach(test => {
        // Standardize origins to the format of https://example.com.
        let origin = test.origin;

        // Collect all origins.
        originsArray.push(origin);
        originsString += '\"' + origin + '\", ';
      });
      originsString = originsString.substring(0,originsString.length-2);

      // Return fake response if this.gcpProjectId is 'TEST_PROJECTID';
      if (this.gcpProjectId === 'TEST_PROJECTID') {
        let fakeResults = this.fakeResponses(tests);
        return fakeResults;
      }

      // Perform BigQuery query.
      let query = this.deviceQuery(originsString);
      let rows = await this.bigQueryHandler.query(query);
      let results = [],
          originsOrder = {},
          originsIndex = 0;

      tests.forEach(test => {
        results.push({
          status: Status.RETRIEVED,
          origin: test.origin,
          metrics : []
        });
        originsOrder[test.origin] = originsIndex;
        originsIndex++;
      });

      rows.forEach(row => {
        let index = originsOrder[row.Origin];
        results[index].metrics.push(row);
      });

      return results;

    } else {
      return [];
    }
	}

	retrieveBatch(results, options) {
    throw new Error('retrieveBatch is not supported in CrUXBigQueryGatherer');
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
      'https://example.com': [{
        Date: '202004',
        Origin: 'https://example.com',
        Device: 'mobile',
        FirstContentfulPaint: {
          p75: 900,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }],
      'https://web.dev': [{
        Date: '202005',
        Origin: 'https://web.dev',
        Device: 'mobile',
        FirstContentfulPaint: {
          p75: 1000,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }, {
        Date: '202004',
        Origin: 'https://web.dev',
        Device: 'mobile',
        FirstContentfulPaint: {
          p75: 1100,
          slowDensity: 0.1,
          averageDensity: 0.1,
          fastDensity: 0.8,
        },
      }],
    }

    return tests.map(test => {
      let cruxbigquery = test.cruxbigquery || {};
      return {
        status: Status.RETRIEVED,
        origin: cruxbigquery.origin,
  			metrics: fakeMetrics[cruxbigquery.origin] || fakeMetrics['web.dev'],
      }
    });
  }

  deviceQuery(origins) {
    let query = `
      WITH dates AS (
        SELECT DISTINCT(yyyymm)
        FROM \`chrome-ux-report.materialized.device_summary\`
        ORDER BY yyyymm DESC LIMIT 13)
      SELECT
        yyyymm AS \`Date\`,
        origin AS \`Origin\`,
        device AS \`Device\`,
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
      FROM \`chrome-ux-report.materialized.device_summary\`
      WHERE origin IN (${origins})
      AND yyyymm IN (SELECT yyyymm FROM dates)
      ORDER BY origin, yyyymm;`;

    return query;
  }

}

module.exports = CrUXBigQueryGatherer;
