/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const BudgetsExtension = require('../../src/extensions/budgets');

let budgetsExtension = new BudgetsExtension({
  dataSource: 'webpagetest',
});

describe('Budgets unit test', () => {
  beforeEach(() => {

  });

  it('adds budget metrics to a result after run.', async () => {
    let test = {
      url: 'google.com',
      webpagetest: {},
      budgets: {
        metrics: {
          FCP: {seconds: 1},
          SpeedIndex: {seconds: 3},
        }
      },
    };
    let result = {
      url: 'google.com',
      webpagetest: {
        metrics: {
          FCP: 1500,
          SpeedIndex: 6000,
        }
      },
    };

    budgetsExtension.postRun(test, result);

    expect(result).toEqual({
      url: 'google.com',
      webpagetest: {
        metrics: {
          FCP: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        metrics: {
          FCP: {
            ms: 1000,
            seconds: 1,
            overRatio: 0.5,
          },
          SpeedIndex: {
            ms: 3000,
            seconds: 3,
            overRatio: 1,
          },
        }
      }
    });
  });

  it('adds budget metrics to a result after retrieve.', async () => {
    let result = {
      url: 'google.com',
      webpagetest: {
        metrics: {
          FCP: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        metrics: {
          FCP: {
            ms: 1000,
            seconds: 1,
          },
          SpeedIndex: {
            ms: 3000,
            seconds: 3,
          },
        }
      }
    };

    budgetsExtension.postRetrieve(result);

    expect(result).toEqual({
      url: 'google.com',
      webpagetest: {
        metrics: {
          FCP: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        metrics: {
          FCP: {
            ms: 1000,
            seconds: 1,
            overRatio: 0.5,
          },
          SpeedIndex: {
            ms: 3000,
            seconds: 3,
            overRatio: 1,
          },
        }
      }
    });
  });
});
