# CrUX API Gatherer

## Overview

For more details in the Chrome UX Report API, please check out
[the official documentation](https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started).

Below is a sample `Test` with `cruxapi` property that defines the
configuration for running a WebPageTest audit.

```
{
  "label": "Example",
  "url": "https://examples.com",
  "gatherer": "cruxapi",
  "cruxapi": {
    "settings": {
      "urlType" : "Page",
      "formFactor": "ALL"
    }
  }
}
```

## Required Environmental Variables

- `CRUX_APIKEY` - The API Key to access CrUX API endpoint. See [the official doc](https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started) for details.

## Audit Lifecycle

CrUX API returns the metrics immediately after executing `run` action. Hence, 
there's no need to execute `retrieve` step.

Optionally, you may want to re-retrieve the metrics to a `Result` object by
executing `retrieve` action.

## Configuration details

- `settings` <Object>: The settings is an object that defines a list of
parameters for running a CrUX API audit. See the following parameters for details.
- `settings.urlType` <string>: Specify `Page` or `Origin` to determine the CrUX metric level.
- `settings.formFactor` <string>: The analysis strategy to use: `desktop` or
`mobile`.
with comma.

## Run a Test and retrieve Metrics

After running, the `cruxapi` object in a `Result` object will
contain the `metrics` object and its corresponding values, like below:

```
{
  "label": "Example",
  "url": "https://examples.com",
  "status": "Retrieved",  
  "cruxapi": {
    "status": "Retrieved",
    "statusText": "Success",
    "metrics": {
      "LargestContentfulPaint": {
        "p75": 2641,
        "good": 0.7142390594382795,
        "ni": 0.193990855649903,
        "poor": 0.09177008491182273
      },
      "FirstInputDelay": {
        "p75": 63,
        "good": 0.8021015761821326,
        "ni": 0.1429509632224161,
        "poor": 0.05494746059544616
      },
      "CumulativeLayoutShift": {
        "p75": "0.44",
        "good": 0.654765332565504,
        "ni": 0.03224877627411453,
        "poor": 0.31298589116037934
      },
      "FirstContentfulPaint": {
        "p75": 2742,
        "good": 0.06867761917586854,
        "ni": 0.732022623215728,
        "poor": 0.19929975760840518
      }
    },
    "settings": {
      "urlType": "Page",
      "formFactor": "PHONE"
    },
    "errors": []
  }
}
```

Please see [Chrome UX Report API docs](https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started) for full details of the metric definitions.
