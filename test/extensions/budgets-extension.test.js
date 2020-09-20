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

const BudgetsExtension = require('../../src/extensions/budgets-extension');
const Status = require('../../src/common/status');
let extension;

describe('Budgets unit test', () => {
  beforeEach(() => {
    extension = new BudgetsExtension({});
  });

  it('adds budgets only to a result after run.', async () => {
    let test = {
      url: 'google.com',
      webpagetest: {},
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
          CSS: 100,
        },
      },
    };
    let result = {
      url: 'google.com',
      status: Status.SUBMITTED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
    };

    extension.afterRun({
      test: test,
      result: result
    });

    expect(result).toEqual({
      url: 'google.com',
      status: Status.SUBMITTED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
          CSS: 100,
        },
      },
    });
  });

  it('adds budget metrics to a result after run with retrieved.',
      async () => {
    let test = {
      url: 'google.com',
      webpagetest: {},
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
          CSS: 100,
        },
      },
    };
    let result = {
      url: 'google.com',
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
    };

    extension.afterRun({
      test: test,
      result: result
    });

    expect(result).toEqual({
      url: 'google.com',
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
          CSS: 200,
        }
      },
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
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
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
        budget: {
          FirstContentfulPaint: 1000,
          SpeedIndex: 3000,
        },
      }
    };

    extension.afterRetrieve({
      result: result
    });

    expect(result).toEqual({
      url: 'google.com',
      status: Status.RETRIEVED,
      webpagetest: {
        metrics: {
          FirstContentfulPaint: 1500,
          SpeedIndex: 6000,
        }
      },
      budgets: {
        metricPath: 'webpagetest.metrics.[METRIC_NAME]',
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

  it('adds errors to the Result object after retrieve when error occurs in ' +
    'budgets extension', async () => {
      let result = {
        url: 'google.com',
        status: Status.RETRIEVED,
        webpagetest: {
          metrics: {
            FirstContentfulPaint: 1500,
            SpeedIndex: 6000,
          }
        },
        budgets: {
          metricPath: 'fake.metric.path',
          budget: {
            FirstContentfulPaint: 1000,
            SpeedIndex: 3000,
          },
        }
      };

      extension.afterRetrieve({
        result: result
      });

      expect(result).toEqual({
        url: 'google.com',
        status: Status.RETRIEVED,
        webpagetest: {
          metrics: {
            FirstContentfulPaint: 1500,
            SpeedIndex: 6000
          }
        },
        budgets: {
          metricPath: 'fake.metric.path',
          budget: {
            FirstContentfulPaint: 1000,
            SpeedIndex: 3000
          },
          metrics: {
            FirstContentfulPaint: {},
            SpeedIndex: {}
          }
        },
        errors: [
          '[Budgets] Unable to get metric value for FirstContentfulPaint with path: fake.metric.path',
          '[Budgets] Unable to get metric value for SpeedIndex with path: fake.metric.path'
        ]
      });
    });
});
