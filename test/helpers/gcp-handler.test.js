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

const {BigQueryHandler} = require('../../src/helpers/gcp-handler');

describe('BigQueryHandler test', () => {
  it('creates corresponding BigQuery client in Node.js platform.', async () => {
    // Use default platform as Node.
    let handler = new BigQueryHandler({
      projectId: 'fake-project',
    });
    expect(handler.client).not.toBe(undefined);
  });

  it('perfroms query through BigQuery client in Node.js platform', async () => {
    let handler = new BigQueryHandler({
      projectId: 'fake-project',
      platform: 'Node',
    });

    handler.client.createQueryJob = () => [{
      getQueryResults: () => [[{
        date: '202001', value: 123
      }, {
        date: '202002', value: 456,
      }]],
    }];

    let rows = await handler.query('fake query SQL');
    expect(rows.length).toEqual(2);
  });

  it('perfroms query through BigQuery client in AppScript platform', async () => {
    let remainingPages = 3;
    let getPageToken = () => {
      if (remainingPages <= 0) {
        return null;
      } else {
        remainingPages--;
        return `pageToken-${remainingPages}`;
      }
    }

    global.BigQuery = {
      Jobs: {
        query: () => ({
          jobReference: {
            jobId: 'fake-id',
          }
        }),
        getQueryResults: () => ({
          jobReference: {
            jobId: 'fake-id',
          },
          schema: {
            fields: [{
              name: 'date',
            }, {
              name: 'field-1',
            }, {
              name: 'field-2',
            }
          ],
          },
          jobComplete: true,
          pageToken: getPageToken(),
          rows: [{
            f: [{v: '202001'}, {v: 123}, {v:456}],
          }, {
            f: [{v: '202002'}, {v: 123}, {v:456}],
          }],
        }),
      }
    };
    global.Utilities = {
      sleep: jest.fn(),
    };

    let handler = new BigQueryHandler({
      projectId: 'fake-project',
      platform: 'AppScript',
    });

    let rows = await handler.query('fake query SQL');
    expect(rows.length).toEqual(8);
  });

  it('throws error when missing projectId.', async () => {
    expect(() => {
      let handler = new BigQueryHandler();
    }).toThrow(Error);
  });

  it('throws error when initializing a unsupported platform.', async () => {
    expect(() => {
      let handler = new BigQueryHandler({
        projectId: 'fake-project',
        platform: 'NonSupported',
      });
    }).toThrow(Error);
  });

});
