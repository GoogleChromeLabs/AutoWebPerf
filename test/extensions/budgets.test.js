/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const PerfBudgetsExtension = require('../../src/extensions/budgets');

let perfBudgetExtension = new PerfBudgetsExtension({
  budgets: {
    dataSource: 'webpagetest',
  },
});

describe('Budgets unit test', () => {
  it('adds budget metrics to a result after run.', async () => {
    let test = {
      url: 'google.com',
      webpagetest: {},
      budgets: {
        dataSource: 'webpagetest',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
          CSS: 100,
        },
      },
    };
    let result = {
      url: 'google.com',
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
    };

    perfBudgetExtension.afterRun({test: test, result: result});

    expect(result).toEqual({
      url: 'google.com',
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
      budgets: {
        dataSource: 'webpagetest',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
          CSS: 100,
        },
        metrics: {
          FirstContentfulPaint: {
            budget: {
              milliseconds: 1000,
              seconds: 1,
            },
            metric: {
              milliseconds: 1500,
              seconds: 1.5,
            },
            overRatio: 0.5,
          },
          SpeedIndex: {
            budget: {
              milliseconds: 3000,
              seconds: 3,
            },
            metric: {
              milliseconds: 6000,
              seconds: 6,
            },
            overRatio: 1,
          },
          CSS: {
            budget: {
              KB: 100,
            },
            metric: {
              KB: 200,
            },
            overRatio: 1,
          },
        }
      },
    });
  });

  it('adds budget metrics to a result after retrieve.', async () => {
    let result = {
      url: 'google.com',
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        dataSource: 'webpagetest',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
        },
      }
    };

    perfBudgetExtension.afterRetrieve({result: result});

    expect(result).toEqual({
      url: 'google.com',
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        dataSource: 'webpagetest',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
        },
        metrics: {
          FirstContentfulPaint: {
            budget: {
              milliseconds: 1000,
              seconds: 1,
            },
            metric: {
              milliseconds: 1500,
              seconds: 1.5,
            },
            overRatio: 0.5,
          },
          SpeedIndex: {
            budget: {
              milliseconds: 3000,
              seconds: 3,
            },
            metric: {
              milliseconds: 6000,
              seconds: 6,
            },
            overRatio: 1,
          },
        }
      }
    });
  });
});
