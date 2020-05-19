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
  constructor(config, apiHelper, options) {
    super();
    assert(config, 'Parameter config is missing.');
    assert(apiHelper, 'Parameter apiHelper is missing.');

    this.projectId = config.gcpProjectId;

    //this.origins = config.origins;
    //this.keyFilename = options.keyFilename;

		// Create the BigQuery Handler.
		/*this.bigQueryHandler = new BigQueryHandler({
      projectId: config.projectId,
			keyFilename: this.keyFilename,
			platform: config.platform, // 'Node' or 'GoogleSheets'.
    });
    */

    // Query:
    // https://console.cloud.google.com/bigquery?sq=221270044539:1f5e2d56a02c41cab74794a57c5bab70
    // async function query() {
    //   const query = `SELECT
		//     	yyyymm as Date,
		//     	Origin,
		//     	Device,
		//     	p75_ttfb,
		//     	p75_fp,
		//     	p75_fcp,
		//     	p75_lcp,
		//     	p75_fid,
		//     	p75_cls,
		//     	p75_dcl,
		//     	p75_ol,
		//     	IF(fast_fp>0, fast_fp /(fast_fp + avg_fp + slow_fp), null) AS fast_fp,
		//     	IF(avg_fp>0, avg_fp / (fast_fp + avg_fp + slow_fp), null) AS avg_fp,
		//     	IF(slow_fp>0, slow_fp / (fast_fp + avg_fp + slow_fp), null) AS slow_fp,
		//     	IF(fast_fcp>0, fast_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS fast_fcp,
		//     	IF(avg_fcp>0, avg_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS avg_fcp,
		//     	IF(slow_fcp>0, slow_fcp / (fast_fcp + avg_fcp + slow_fcp), null) AS slow_fcp,
		//     	IF(fast_lcp>0, fast_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS fast_lcp,
		//     	IF(avg_lcp>0, avg_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS avg_lcp,
		//     	IF(slow_lcp>0, slow_lcp / (fast_lcp + avg_lcp + slow_lcp), null) AS slow_lcp,
		//     	IF(fast_fid>0, fast_fid / (fast_fid + avg_fid + slow_fid), null) AS fast_fid,
		//     	IF(avg_fid>0, avg_fid / (fast_fid + avg_fid + slow_fid), null) AS avg_fid,
		//     	IF(slow_fid>0, slow_fid / (fast_fid + avg_fid + slow_fid), null) AS slow_fid,
		//     	IF(fast_dcl>0, fast_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS fast_dcl,
		//     	IF(avg_dcl>0, avg_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS avg_dcl,
		//     	IF(slow_dcl>0, slow_dcl / (fast_dcl + avg_dcl + slow_dcl), null) AS slow_dcl,
		//     	IF(fast_ol>0, fast_ol / (fast_ol + avg_ol + slow_ol), null) AS fast_ol,
		//     	IF(avg_ol>0, avg_ol / (fast_ol + avg_ol + slow_ol), null) AS avg_ol,
		//     	IF(slow_ol>0, slow_ol / (fast_ol + avg_ol + slow_ol), null) AS slow_ol,
		//     	IF(fast_ttfb>0, fast_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS fast_ttfb,
		//     	IF(avg_ttfb>0, avg_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS avg_ttfb,
		//     	IF(slow_ttfb>0, slow_ttfb / (fast_ttfb + avg_ttfb + slow_ttfb), null) AS slow_ttfb,
		//     	IF(small_cls>0, small_cls / (small_cls + medium_cls + large_cls), null) AS small_cls,
		//     	IF(medium_cls>0, medium_cls / (small_cls + medium_cls + large_cls), null) AS medium_cls,
		//     	IF(large_cls>0, large_cls / (small_cls + medium_cls + large_cls), null) AS large_cls,
		//     	desktopDensity,
		//     	phoneDensity,
		//     	tabletDensity,
		//     	_4GDensity,
		//     	_3GDensity,
		//     	_2GDensity,
		//     	slow2GDensity,
		//     	offlineDensity,
		//     	notification_permission_accept,
		//     	notification_permission_deny,
		//     	notification_permission_ignore,
		//     	notification_permission_dismiss
		//       FROM
		//         \`chrome-ux-report.materialized.device_summary\`
		//       WHERE
		//         origin IN (` + this.origins + `)
		//       ORDER BY
		//         Origin,
		//         Date;`;
		//
    //   // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    //   const options = {
    //     query: query,
    //     // Location must match that of the dataset(s) referenced in the query.
    //     location: 'US',
    //   };
		//
    //   // Run the query as a job
    //   const [job] = await bigquery.createQueryJob(options);
    //   console.log(`Job ${job.id} started.`);
		//
    //   // Wait for the query to finish
    //   const [rows] = await job.getQueryResults();
		//
    //   // Print the results
    //   console.log('Rows:');
    //   rows.forEach(row => console.log(row));
    // }
    // query();
		//
		//
		//
    // var request = {
    //   query: '',
    //   useLegacySql: false
    // };
		//
    // var queryResults = BigQuery.Jobs.query(request, projectId);
    // var jobId = queryResults.jobReference.jobId;
		//
    // // Check on status of the Query Job.
    // var sleepTimeMs = 500;
    // while (!queryResults.jobComplete) {
    //   Utilities.sleep(sleepTimeMs);
    //   sleepTimeMs *= 2;
    //   queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
    // }
		//
    // // Get all the rows of results.
    // var rows = queryResults.rows;
    // while (queryResults.pageToken) {
    //   queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
    //     pageToken: queryResults.pageToken
    //   });
    //   rows = rows.concat(queryResults.rows);
    // }
		//
    // return {
    //   status: Status.RETRIEVED,
    //   statusText: 'Success',
    //   settings: test.crux.settings,
    //   metadata: metadata,
    //   metrics: metrics.toObject() || {},
    //   errors: errors,
    // }
  }

  run(test, options) {
    assert(test, 'Parameter test is missing.');
    options = options || {};
  }

  retrieve(result, options) {
		assert(result, 'Parameter result is missing.');

		// TODO: Replace the dummy response with real code.
		return {
      status: Status.RETRIEVED,
    };
  }

	runBatch(tests, options) {
		assert(tests, 'Parameter tests is missing.');

    console.log('runBatch test');

    return this.fakeResponses(tests);

		// TODO: Replace the dummy response with real code. Make sure the length
    // of the responses match the length of Tests, i.e. # of origins.
		//return this.fakeResponses(tests);
	}

	retrieveBatch(results, options) {
		assert(results, 'Parameter results is missing.');

    return {

      status: Status.RETRIEVED,
    };

		// TODO: Replace the dummy response with real code.
		//return {
		//	status: Status.RETRIEVED,
		//};
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
}

module.exports = ChromeUXReportGatherer;
