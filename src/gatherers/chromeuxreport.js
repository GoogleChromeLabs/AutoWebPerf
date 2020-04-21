'use strict';

const assert = require('../utils/assert');
const Status = require('../common/status');
const {Metrics} = require('../common/metrics');
const Gatherer = require('./gatherer');
const {BigQuery} = require('@google-cloud/bigquery');
const bigquery = new BigQuery();

class ChromeUXReportGatherer extends Gatherer {
	constructor(config, apiHelper, options) {
		super();
        assert(config, 'Parameter config is missing.');
     	assert(apiHelper, 'Parameter apiHelper is missing.');


     	this.projectId = config.projectId;
     	this.origins = config.origins;
     	this.debug = options.debug;


     	// Query:
  		// https://console.cloud.google.com/bigquery?sq=221270044539:1f5e2d56a02c41cab74794a57c5bab70
     	async function query() {
		    const query = `SELECT 
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
		        origin IN (`+this.origins+`) 
		      ORDER BY 
		        Origin,
		        Date;`;

		    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
		    const options = {
		      query: query,
		      // Location must match that of the dataset(s) referenced in the query.
		      location: 'US',
		    };

		    // Run the query as a job
		    const [job] = await bigquery.createQueryJob(options);
		    console.log(`Job ${job.id} started.`);

		    // Wait for the query to finish
		    const [rows] = await job.getQueryResults();

		    // Print the results
		    console.log('Rows:');
		    rows.forEach(row => console.log(row));
		}
		query();

		
     	
  		var request = {
    		query: '',
    		useLegacySql: false
 		};

 		var queryResults = BigQuery.Jobs.query(request,projectId);
  		var jobId = queryResults.jobReference.jobId;

		// Check on status of the Query Job.
		var sleepTimeMs = 500;
		while (!queryResults.jobComplete) {
		Utilities.sleep(sleepTimeMs);
			sleepTimeMs *= 2;
			queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId);
		}

		// Get all the rows of results.
		var rows = queryResults.rows;
		while (queryResults.pageToken) {
			queryResults = BigQuery.Jobs.getQueryResults(projectId, jobId, {
		    pageToken: queryResults.pageToken
		});
		    rows = rows.concat(queryResults.rows);
		}


     	return {
			status: Status.RETRIEVED,
	        statusText: 'Success',
	        settings: test.crux.settings,
	        metadata: metadata,
	        metrics: metrics.toObject() || {},
	        errors: errors,
	    }
	}

	run(test, options) {
    	assert(test, 'Parameter test is missing.');
    	options = options || {};



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

	retrieve(resultObj, options) {
		return this.run(resultObj, options);
	}
}

module.exports = ChromeUXReportGatherer;