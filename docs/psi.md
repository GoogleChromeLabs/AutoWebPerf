# PageSpeed Insights Gatherer

## Overview

For more details in the PageSpeed Insights API, please check out
[the official documentation](https://developers.google.com/speed/docs/insights/v5/get-started).

Below is a sample `Test` with `psi` property that defines the
configuration for running a WebPageTest audit.

```
{
  "label": "Example",
  "url": "https://examples.com",
  "gatherer": "psi",
  "psi": {
    "settings": {
      "locale": "en-GB",
      "strategy": "mobile"
    }
  }
}
```

## Optional Environmental Variables

- `PSI_APIKEY` - Use an API Key to relax rate limiting, for example if you see an error like:

> Quota exceeded for quota metric 'Queries' and limit 'Queries per minute' of service 'pagespeedonline.googleapis.com' for consumer 'project_number:nnnn'."

See [the official doc](https://developers.google.com/speed/docs/insights/v5/get-started#key) for details.

## Audit Lifecycle

PageSpeed Insights API returns the metrics immediately after executing `run`
action. Hence, there's no need to execute `retrieve` step.

Optionally, you may want to re-retrieve the metrics to a `Result` object by
executing `retrieve` action.

## Configuration details

Please see [PageSpeed Insights API docs](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed) for details.

- `settings` <Object>: The settings is an object that defines a list of
parameters for running a PSI audit. See the following parameters for details.
- `settings.locale` <string>: The locale used to localize formatted result.
- `settings.strategy` <string>: The analysis strategy to use: `desktop` or
`mobile`.
- `settings.category` <string>: The list of categories to run with Lighthouse:
`accessibility`, `best-practices`, `performance`, `pwa` or `seo`, delimited
with comma.

## Run a Test and retrieve Metrics

After running, the `psi` object in a `Result` object will
contain the `metrics` object and its corresponding values, like below:

```
{
  "label": "Example",
  "url": "https://examples.com",
  "status": "Retrieved",  
  "psi": {
    "status": "Retrieved",
    "statusText": "Success",
    "settings": {
      "locale": "en-GB",
      "strategy": "mobile"
    },
    "metadata": {
      "testId": "https://examples.com",
      "requestedUrl": "https://examples.com",
      "finalUrl": "https://examples.com",
      "lighthouseVersion": "6.0.0",
      "userAgent": "..."
    },
    "metrics": {
      "RenderBlockingResources": 56848,
      "crux": {
        "LargestContentfulPaint": {
          "category": "AVERAGE",
          "percentile": 3610,
          "good": 0.5500216829760357,
          "ni": 0.24342440183268282,
          "poor": 0.2065539151912815
        },
        ...
      },
      "lighthouse": {
        "FirstContentfulPaint": 700,
        "FirstMeaningfulPaint": 700,
        "LargestContentfulPaint": 1450,
        "SpeedIndex": 1417,
        ...
      }
    }
  }
}
```

Please note that the metrics are grouped into several sub-properties,
including `crux` and `lighthouse`. Each metric name here uses standardized
metric name defined in `src/common/metrics.js`.

Please see [PageSpeed Insights API docs](https://developers.google.com/speed/docs/insights/v5/reference/pagespeedapi/runpagespeed) for full details of
the metric definitions.
