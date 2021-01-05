# CrUX BigQuery Gatherer

## Overview

For more details in the Chrome UX Report, please check out
[the official documentation](https://developers.google.com/web/tools/chrome-user-experience-report).

Below is a sample `Test` with `cruxapi` property that defines the
configuration for running a WebPageTest audit.

```
{
  "label": "Example",
  "origin": "https://example.com",
  "gatherer": "cruxbigquery"
}
```

Please note that CrUX BigQuery API is required to fetch results in `batch` mode. Please
make sure to add the `--batch-mode` parameter when executing it via the CLI. For example:

```
./awp run json:examples/tests-cruxbigquery.json json:output/results.json --batch-mode
```

## Required Environmental Variables

- `GCP_PROJECT_ID` - The Google Cloud unique project ID. See [the official doc](https://cloud.google.com/resource-manager/docs/creating-managing-projects) for creating a GCP project.
- `SERVICE_ACCOUNT_CREDENTIALS` - The path to the Service Account json file.

## Audit Lifecycle

CrUX BigQuery API returns the metrics immediately after executing `run` action. Hence, 
there's no need to execute `retrieve` step. Optionally, you may want to re-retrieve the 
metrics to a `Result` object by executing `retrieve` action.

## Configuration details

- `origin` <string>: CrUX BigQuery gatherer takes `origin` in a `Test` instead of `url`. Please note that the 
origin should start with a protocol, e.g. https://. See 

## Run a Test and retrieve Metrics

After running, the `cruxbigquery` object in a `Result` object will
contain the `metrics` object and its corresponding values, like below:

```
{
  "label": "Example",
  "origin": "https://example.com",
  "status": "Retrieved",  
  "cruxbigquery": {
    "status": "Retrieved",
    "origin": "https://example.com",
    "metrics": [
      {
        "Date": 201911,
        "Origin": "https://example.com",
        "Device": "desktop",
        "p75_ttfb": 700,
        "p75_fp": 1300,
        "p75_fcp": 1300,
        "p75_lcp": 1600,
        "p75_fid": 0,
        "p75_cls": "0.05",
        "p75_dcl": 1600,
        "p75_ol": 2600,
        "fast_fp": 0.5394573064475977,
        "avg_fp": 0.41921832213094345,
        "slow_fp": 0.0413243714214588,
        "fast_fcp": 0.785305105853051,
        "avg_fcp": 0.14919053549190536,
        "slow_fcp": 0.06550435865504359,
        "fast_lcp": 0.9038031319910513,
        "avg_lcp": 0.06062639821029082,
        "slow_lcp": 0.03557046979865772,
        "fast_fid": 0.9914021164021164,
        "avg_fid": 0.006393298059964726,
        "slow_fid": 0.002204585537918871,
        "fast_dcl": 0.6841195356878241,
        "avg_dcl": 0.27265991602864903,
        "slow_dcl": 0.0432205482835268,
        "fast_ol": 0.7125312713213555,
        "avg_ol": 0.2572208323857176,
        "slow_ol": 0.030247896292926995,
        "fast_ttfb": 0.5149856658848059,
        "avg_ttfb": 0.4289809747198332,
        "slow_ttfb": 0.05603335939536096,
        "small_cls": 0.7818437719915552,
        "medium_cls": 0.15435139573070605,
        "large_cls": 0.06380483227773867,
        "desktopDensity": 0.4015,
        "phoneDensity": 0,
        "tabletDensity": 0,
        "_4GDensity": 0.3854,
        "_3GDensity": 0.0161,
        "_2GDensity": 0,
        "slow2GDensity": 0,
        "offlineDensity": 0,
        "notification_permission_accept": null,
        "notification_permission_deny": null,
        "notification_permission_ignore": null,
        "notification_permission_dismiss": null
      },
      ...
    ],
    "errors": []
  }
}
```

Please see [Chrome UX Report API docs](https://developers.google.com/web/tools/chrome-user-experience-report/api/guides/getting-started) for full details of the metric definitions.
