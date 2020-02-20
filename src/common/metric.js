/**
 * The following standardized metric names are based on the performance
 * metrics used in Lighthouse: https://web.dev/performance-scoring/
 */
module.exports = {
  timing: {
    TimeToFirstByte: 'TimeToFirstByte',
    FirstPaint: 'FirstPaint',
    FirstMeaningfulPaint: 'FirstMeaningfulPaint',
    FirstContentfulPaint: 'FirstContentfulPaint',
    VisualComplete: 'VisualComplete',
    SpeedIndex: 'SpeedIndex',
    DOMContentLoaded: 'DOMContentLoaded',
    LoadEvent: 'LoadEvent',
    TimeToInteractive: 'TimeToInteractive',
    TotalBlockingTime: 'TotalBlockingTime',
    FirstCPUIdle: 'FirstCPUIdle',
    FirstInputDelay: 'FirstInputDelay',
    LargestContentfulPaint: 'LargestContentfulPaint',
  },
  resourceSize: {
    HTML: 'HTML',
    Javascript: 'Javascript',
    CSS: 'CSS',
    Fonts: 'Fonts',
    Images: 'Images',
    Videos: 'Videos',
  },
  resourceCount: {
    DOMElements: 'DOMElements',
    Connections: 'Connections',
    Requests: 'Requests',
  },
  scores: {
    Performance: 'Performance',
    ProgressiveWebApp: 'ProgressiveWebApp',
  }
}
