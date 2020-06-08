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

const assert = require('../utils/assert');

/**
 * The handler for Google Cloud BigQuery with support of multiple platforms
 * including local Node.js, GCP and AppScript-based environments
 * (e.g. GoogleSheets.)
 *
 * Reference:
 * - BigQuery with Node.js - https://cloud.google.com/bigquery/docs/reference/libraries
 * - BigQuery with AppScript - https://developers.google.com/apps-script/advanced/bigquery
 */
class BigQueryHandler {
  constructor(config, apiHandler, options) {
    this.platform = config.platform || 'Node';
    this.projectId = config.projectId;
    this.keyFilename = config.keyFilename;

    switch(this.platform.toLowerCase()) {
      case 'gcp':
      case 'node':
        // Create GCP client for each requested GCP product.
        let gcpConfig = {
          projectId: this.projectId,
          keyFilename: this.keyFilename,
        };

        const BigQueryModule = require('@google-cloud/bigquery');
        this.client = new BigQueryModule.BigQuery(gcpConfig);
        break;

      case 'appscript':
        // Do nothing.
        break;

      default:
        throw new Error(`${this.platform}  is not supported.`);
        break;
    }
  }

  /**
   * Run BigQuery query and return the array of rows.
   * @param {string} query Query string in SQL format.
   * @param {Object} options Options object.
   * @return {Array<object>} Rows of queried results.
   *
   * Available options:
   * - bigQueryOptions {object}: The options object to be passed to BigQuery
   *     functions.
   * - timeout {number}: The timeout limit in milliseconds for all BigQuery
   *     functions. Default 5000 ms.
   * - verbose {boolean}: Whether to print verbose logs.
   */
  async query(query, options) {
    assert(query, 'query is missing.');
    options = options || {};
    let timeout = options.timeout || 1000 * 60 * 5; // Default 5 minutes.

    switch(this.platform.toLowerCase()) {
      case 'gcp':
      case 'node':
        {
          // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
          let bigQueryOptions = {
            query: query,
          }

          // Run the query as a job
          const [job] = await this.client.createQueryJob(bigQueryOptions);

          // Wait for the query to finish
          const [rows] = await job.getQueryResults();
          return rows;
        }
        break;

      case 'appscript':
        {
          let request = {
            query: query,
            useLegacySql: false,
          };
          let queryResults = BigQuery.Jobs.query(request, this.projectId);
          let jobId = queryResults.jobReference.jobId;

          if (options.verbose) {
            console.log(`Starting BigQuery job, id = ${jobId}`);
          }

          // Check on status of the Query Job.
          let sleepTimeMs = 500;
          let startMs = new Date().getTime();
          let timeElapseMs = 0;

          while (!queryResults.jobComplete && timeElapseMs < timeout) {
            Utilities.sleep(sleepTimeMs);
            sleepTimeMs *= 2;
            queryResults = BigQuery.Jobs.getQueryResults(this.projectId, jobId);

            // Check if timeout.
            timeElapseMs = new Date().getTime() - startMs;
            if (timeElapseMs >= timeout) throw new Error('BigQuery timeout');
          }

          // Get all the rows of results.
          startMs = new Date().getTime();
          let rows = queryResults.rows;

          while (queryResults.pageToken && timeElapseMs < timeout) {
            queryResults = BigQuery.Jobs.getQueryResults(
                this.projectId, jobId, {
                  pageToken: queryResults.pageToken
                });
            rows = rows.concat(queryResults.rows);

            // Check if timeout.
            timeElapseMs = new Date().getTime() - startMs;
            if (timeElapseMs >= timeout) throw new Error('BigQuery timeout');
          }

          // Parse rows with specific field names.
          let fields = queryResults.schema.fields.map(field => field.name);
          rows = rows.map(row => {
            let newRow = {};
            let columnIndex = 0;
            fields.forEach(column => {
              newRow[column] = row.f[columnIndex].v;
              columnIndex++;
            });
            return newRow;
          });
          return rows;
        }
        break;

      default:
        throw new Error(`${this.platform}  is not supported.`);
        break;
    }
  }
}

module.exports = {
  BigQueryHandler,
};
