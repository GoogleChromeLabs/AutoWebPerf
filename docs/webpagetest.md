# WebPageTest Gatherer

## Overview

For more details on the WebPageTest API, please check out
[the official documentation](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md).

Below is a sample `Test` with `webpagetest` property that defines the
configuration for running a WebPageTest audit.

```
{
  "label": "Example",
  "url": "https://example.com",
  "gatherer": "webpagetest",
  "webpagetest": {
    "settings": {
      "locationId": "Dulles_MotoG",
      "device": "Pixel",
      "connection": "4G",
      "runs": 1,
      "repeatView": true,
      "timeline": true,
      "block": null,
      "script": null
    }
  }
}
```

## Required Environmental Variables

- `GCP_PROJECT_ID` - The project unique ID in the Google Cloud Platform. 
- `SERVICE_ACCOUNT_CREDENTIALS` - The path to the Service Account json file.

## Audit Lifecycle

A WebPageTest run may take a few minutes to complete, depending on the parameters
like number of runs, locations, repeat views, etc.

Hence, the auditing model is asynchronous. After executing a `run` action,
WebPageTeset won't return the metric values immediately. Instead, it is required
to execute a `retrieve` action to retrieve the metric values.

The following CLI example explains the two-steps approach:

```
# Run tests
./awp run --tests=examples/tests.json --results=output/results.json

# Retrieve results
./awp retrieve --tests=examples/tests.json --results=output/results.json
```

## Configuration details

- `settings` <Object>: The settings is an object that defines a list of parameters for
running a WebPageTest audit. See the following parameters for details.
- `settings.locationId` <string>: Location ID, used as the `location`
parameter in the [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.connection` <string>: Network connection speed, like `3G` or `4G`.
This will be used as the `connectivity` parameter in [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.device` <string>: Mobile device name, as the `mobileDevice` parameter in
[WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.runs` <number>: Number of runs per audit, the same as in `runs` parameter
in the [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.repeatView` <boolean>: Whether to include repeat view test in the
WebPageTest report. This will be used for `fvonly` in the
[WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters). Please note that if `repeatView`
is set to true, `fvonly` will be 0, and vise versa.
- `settings.timeline` <boolean>: Whether to include the timeline view in the
WebPageTest report, used as `timeline` in [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.block` <string>: Whether to block specific assets from network
requests. This will be used as `block` in [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).
- `settings.script` <string>: Whether to run custom steps in a WebPageTest audit.
This will be used as `script` in [WebPageTest RESTful API](https://github.com/WPO-Foundation/webpagetest-docs/blob/master/dev/api.md#parameters).


## Run a Test

After running, the `webpagetest` object in a `Result` object will
contain the `metadata` object and its corresponding values, like below:

```
{
  "label": "Example",
  "url": "https://example.com",
  "status": "Retrieved",
  "webpagetest": {
    "settings": {
      "locationId": "Dulles_MotoG",
      "device": "Pixel",
      "connection": "4G",
      "runs": 1,
      "repeatView": true,
      "timeline": true,
      "block": null,
      "script": null
    },
    "metadata": {
      "testId": "someTestId",
      "ownerKey": "someKey",
      "jsonUrl": "https://webpagetest.org/jsonResult.php?test=someTestId",
      "xmlUrl": "https://webpagetest.org/xmlResult/someTestId/",
      "userUrl": "https://webpagetest.org/result/someTestId/",
      "summaryCSV": "https://webpagetest.org/result/someTestId/page_data.csv",
      "detailCSV": "https://webpagetest.org/result/someTestId/requests.csv"
    }    
  }
}
```

These metadata will be used to retrieve metrics.

## Retrieve Metrics

After retrieving, the `webpagetest` object in a `Test` object will
contain the `metrics` object and its corresponding values, like below:

```
{
  "label": "Example",
  "url": "https://example.com",
  "webpagetest": {
    "settings": {
      "locationId": "Dulles_MotoG",
      "device": "Pixel",
      "connection": "4G",
      "runs": 1,
      "repeatView": true,
      "timeline": true,
      "block": null,
      "script": null
    },
    "metadata": {
      "testId": "someTestId",
      "ownerKey": "someKey",
      "jsonUrl": "https://webpagetest.org/jsonResult.php?test=someTestId",
      "xmlUrl": "https://webpagetest.org/xmlResult/someTestId/",
      "userUrl": "https://webpagetest.org/result/someTestId/",
      "summaryCSV": "https://webpagetest.org/result/someTestId/page_data.csv",
      "detailCSV": "https://webpagetest.org/result/someTestId/requests.csv"
    },
    "metrics": {
      "lighthouse": {
        "Performance": 0.97,
        "ProgressiveWebApp": 0.38,
        "FirstContentfulPaint": 1805.008,
        ...
      },
      "FirstContentfulPaint": 692,
      "SpeedIndex": 702,
      ...
    }
  }
}
```

Since the WebPageTest provides both built-in metrics as well as Lighthouse metrics,
there will be a `lighthouse` property containing the Lighthouse metrics.
