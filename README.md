# AutoWebPerf (AWP)

> AutoWebPerf provides a flexible and scalable framework for running web
performance audits with arbitrary audit tools like WebPageTest and
PageSpeedInsights. This library enables developers to collect metrics
consistently and store metrics to a preferred data store such as local JSON
files, Google Sheets, BigQuery, or an in-house SQL database.

## How it works

AutoWebPerf takes a list of **Tests** from an arbitrary data store platform,
such as local JSONs, Google Sheets, BigQuery, or a self-hosted SQL database.
With the list of Tests, it executes audits based on each Test config, collects
metrics from individual data sources into a list of **Results**.

The process of running an audit through an measurement tool (e.g. WebPageTest)
is defined in the individual **Gatherer**. The logic of reading and writing
with a data platform (e.g. local JSON) is implemented in a **Connector**.

### Feature highlights

- A library of web audit automation that can be plugged-in to any platforms,
like Google Sheets, GCP App Engine, or simply a cron job that writes to JSON
file.
- Providing the ability to run recurring tests with customizable frequency
(e.g. daily, weekly, monthly, etc), network conditions, and other audit configs,
etc.
- Metric gatherers are designed as modules that are decoupled with the output
data format and automation logic.
- Connector modules are designed to write audit results to specific data format
or platforms. e.g. a connector for GoogleSheets.
(See ```src/connectors/googlesheets-connector``` for details)

### How does this compare to the rest of Google's speed measurement tools?

AutoWebPerf serves as a performance audit aggregator that automates the process
of performance audit and metrics collection through multiple speed measurement
tools including WebPageTest, PageSpeedInsight, and Chrome UX Report. As each
individual speed measurement tool provides audit metrics, AutoWebPerf aggregates
the results and writes to any preferred data storage platform, such as local
JSONs, cloud-based database, or GoogleSheets.

## Getting Started

To quickly run audits with CLI:

```
# List CLI options
./awp --help

# Run tests
./awp run --tests=examples/tests.json --results=output/results.json

# Run recurring tests
./awp recurring --tests=examples/tests.json --results=output/results.json

# Retrieve pending results
./awp retrieve --tests=examples/tests.json --results=output/results.json
```

### Using AWP with Node CLI

```
$ npm install
```

#### Run tests

You can run the following anytime for printing CLI usages:

```
./awp --help
```

To run tests, you can run the following CLI command with given Tests JSON, like
`examples/tests.json`, which contains an array of tests. You can check out the
`examples/tests.json` for the data structure of Tests.

```
./awp run --tests=examples/tests.json --results=output/results.json
```

This will generate the result object(s) in the given path to `results.json`.

For some audit platforms like WebPageTest, each test may take a few minutes to
fetch actual results. For these type of *asynchronous* audits, each Result will stay in "Submitted" status. You will need to explicitly retrieve results later.

#### Retrieve test results

Run the following to retrieve the final metrics of results in the
`results.json`.

```
./awp retrieve --tests=examples/tests.json --results=output/results.json
```

This will fetch metrics for all audit platforms and update to the Result object
in the `output/results.json`. You can check out `examples/results.json` for
details in Result objects.

#### Run recurring tests

If you'd like to set up recurring tests, you can define the `recurring` object
that contains `frequency` for that Test.

```
./awp recurring --tests=examples/tests.json --results=output/results.json
```

This will generate the Result object in the `results.json` and updates the next
trigger time to its original Test object in the `tests.json`.

#### Run tests with extensions

```
./awp run --tests=examples/tests.json --results=output/results.json --extensions=budgets
```

## Tests and Results

### Define the Tests

The list of tests is simply an array of Tests objects, like the sample Tests
below. Or check out `src/examples/tests.js` for a detailed example of Tests
list.

```
[{
  "label": "Test-1",
  "url": "example1.com",
  "webpagetest": {
    ...
  }
}, {
  "label": "Test-2",
  "url": "example2.com",
  "psi": {
    ...
  }
}]
```

Each `Test` object defines which audits to run by defining `gatherers` property.
For example, the first `Test` has a `webpagetest` property which defines the
configuration of running a WebPageTest audit. The second `Test` has a `psi`
property that defines how to run PageSpeedInsight audit.

### Generate the Results

After running tests, a list of `Results` is generated like below. Each `Result`
contains its corresponding metrics to the predefined `gatherers` such as
WebPageTest and PageSpeedInsight. See the example below.

```
[{
  "label": "Test-1",
  "url": "example1.com",
  "webpagetest": {
    "metrics": {
      FirstContentfulPaint: 900,
      ...
    }
  }  
}, {
  "label": "Test-2",
  "url": "example2.com",
  "psi": {
    "metrics": {
      FirstContentfulPaint: 900,
      ...
    }
  }  
}]
```

### Environmental Variables

TBD

## Gatherers

AWP supports the following audit gatherers. Please check out the corresponding
documentations for details.

#### WebPageTest

The WebPageTest gatherer runs Tests through either the public WebPageTest
endpoints or a custom private WebPageTest instance.

See [docs/webpagetest.md](docs/webpagetest.md) for more details for the usage
of WebPageTest gatherer.

#### PageSpeed Insights

The PageSpeed Insights gatherer runs Tests through the public
[PageSpeed Insights API](https://developers.google.com/speed/docs/insights/v5/get-started).

See [docs/psi.md](docs/psi.md) for more details for the usage of PSI gatherer.

#### Chrome UX Report API (CrUX API)

TBD

#### Chrome UX Report History (CrUX via BigQuery)

TBD

## Design

AWP is designed with modules, including modules for running audits
with WebPageTest, PageSpeedInsight, or other tools, and modules for
reading/writing data from data platforms such as JSON, GoogleSheets or
a Cloud service.

In a high-level view, there are three types of modules:
- **Gatherer** - A Gatherer runs audits and generates metrics.
- **Connector** - A Connector reads test configs from and writes results to a data
platform, such as a local JSON file or with Google Sheets.
- **Extension** - An Extension adds additional metrics or information, either
before or after running audits.

The AWP engine uses two major JavaScript Object structures for running audits and collecting metrics.

- **Test** - An object that contains the audit configuration for one test task,
such as URL, audit methods, or extension config. You can refer to
`examples/tests.json` for an actual Test object.
- **Result** - An object that contains audit configuration, metrics and overall
status. You can refer to `examples/results.json` for an actual Result object.

### Audit steps

In order to deal with asynchronous audit tool like WebPageTest, AWP breaks the
audit cycle into three steps of actions:

- **Run** - This action takes a list of `Tests` and generates a list of `Results`
objects.
- **Recurring** - Similar to **Run**, this action takes a list of `Tests`,
generates a list of `Results`, and updates nextTriggerTimestamp for each
recurring `Test`. This action is useful when running with periodic or timer-based tasks such as cron job.
- **Retrieve** - This action scans the list of Results, and collects metrics
when the results are not in `Retrieved` status.

### AWP Config

To set up modules and their configurations, an overall AWP Config is required
as a JavaScript Object.

AWP Config has the following required properties:
- `connector`: The name of connector.
- `helper`: A helper for a specific connector, including API Handler and other
helper functions, which will be used in gatherers and extensions.
- `dataSources`: An array of audit sources, such as `webpagetest` or `psi`. Each
of the data source needs to have a corresponding Gatherer file in the
`src/gatherers` folder.
- `extensions`: An array of extensions. Each extension needs to have a
corresponding Extension file in `src/extensions`.

Other optional properties:
- `verbose`: Whether to print verbose messages.
- `debug`: Whether to print debug messages.

The following config example comes from the `examples/awp-config.js`:

```
{
  connector: 'JSON',
  helper: 'Node',
  dataSources: ['webpagetest'],
  json: { // Config for JSON Connector.
    tests: 'tests.json',
    results: 'results.json',
  },
  extensions: [
    'budgets',
  ],
  budgets: { // Config for Budgets extension.
    dataSource: 'webpagetest',
  },
  verbose: true,
  debug: false,
}
```

With the example config above, it will use `JSON` connector which reads and
writes Tests and Results as JSON files. See `examples/tests.json` and
`examples/results.json` for examples.

In addition to fundamental properties, there are a few additional properties
used by modules:
- `json` property as the configuration for **JSONConnector**.
- `budgets` property as the configuration for **BudgetsExtension**

### Usage of AutoWebPerf core

Examples of creating a new instance of AWP:
```
let awp = new AutoWebPerf({
  connector: 'JSON',
  helper: 'Node',
  dataSources: ['webpagetest'],
  extensions: extensions,
  json: { // Config for JSON connector.
    tests: argv['tests'],
    results: argv['results'],
  },
  verbose: verbose,
  debug: debug,
});
```
To submit all tests:
```
awp.run();
```

To submit specific tests using filters:
This will run the test which has id=1 and selected=true properties.
```
awp.run({
  filters: ['id="1"', 'selected'],
});
```

To retrieve all pending results, filtering with status !== "Retrieved".
```
awp.retrieve({
  filters: ['status!=="Retrieved"'],
});
```
For more advanced usage of PatternFilter, please check out
`src/utils/pattern-filter.js` with more examples.


To activate recurring tests without actually submitting. This will update the
nextTriggerTimestamp in the Test objects only.
```
awp.recurring({
  activateOnly: true  
});
```

To run recurring tests:
```
// This will run the actual audit and update the nextTriggerTimestamp.
awp.recurring();
```

To run tests with specific extensions:
```
// This will override the extension list defined in the awpConfig.
awp.run({
  extensions: ['budgets']
})
```


### Gatherer Modules

A Gatherer class extends `src/gatherers/gatherer.js` and overrides the
following methods:

- `constructor(config, apiHelper, options)`:
  - `config`: The config defined in a property with this gatherer's name in the
  AWP config. Some audit tools like WebPageTest or PageSpeedInsight require API keys. The API key for the gatherer is located in the `config.apiKey`.
  - `options`: Additional settings like `verbose` and `debug`.

- `run(test, options)`:
  - `test`: A `Test` object for this audit run. The data required for this
  gatherer (e.g. settings or metadata) will be in the property with the gatherer's
  name. E.g. the data for WebPageTest will be in `webpagetest` of this
  `Test` object.
  - `options`: Additional settings.

- `retrieve(result, options)`:
  - `result`: A `Result` object to retrieve metrics with. The data required for
  this gatherer will be in the property with the gatherer's name. E.g. the data
  and metrics will be in `webpagetest` of this `Result` object.
  - `options`: Additional settings like `verbose` and `debug`.

### Connector Modules

A Connector class extends `src/connectors/connector.js` and overrides the
following methods:

- `constructor(config, apiHandler)`:
  - `config`: The config defined in a property with this connector's name in the
  AWP config.
  - `apiHandler`: The API handler instance used for making API calls.

- `getConfig()`: The method to return the Connector's additional config object.
This config object depends on where this Connector stores its additional
settings including API keys for gatherers. For example, JSONConnector uses the
 `tests.json` and reads additional settings from the `config` property,
including API keys for each gatherers.

- `getTestList(options)`: The method to return the list of `Tests` as an array.
- `updateTestList(newTests, options)`: The method to update `Tests` list, given
 the list of new `Tests`.
- `getResultList(options)`: The method to return the list of `Results` as an
array.
- `appendResultList(newResults, options)`: The method to append new `Results` to
 the end of the current `Results` list.
- `updateResultList(newResults, options)`: The method to update existing
 `Results` in the current `Results` list.

### Extension Modules

A Extension class extends `src/extensions/extension.js` and overrides the
following methods:

- `constructor(config)`:
  - `config`: The config defined in a property with this extension's
name in the AWP config.
- `beforeRun(context)`: The method before executing **Run** step for a `Test`.
  - `context.test`: The corresponding `Test` object.
- `afterRun(context)`: The method after executing **Run** step for a `Test`.
  - `context.test`: The corresponding `Test` object.
  - `context.result`: The corresponding `Result` object.
- `beforeAllRuns(context)`: The method before executing **Run** step.
  - `context.tests`: All `Test` objects in this **Run**.
- `afterAllRuns(context)`: The method after executing **Run** step.
  - `context.tests`: All `Test` objects in this **Run**.
  - `context.results`: All `Result` objects in this **Run**.
- `beforeRetrieve(context)`: The method before executing **Retrieve** step for a `Result`.
  - `context.result`: The corresponding `Result` object.
- `afterRetrieve(context)`: The method after executing **Retrieve** step for a `Result`.
  - `context.result`: The corresponding `Result` object.
- `beforeAllRetrieves(context)`: The method before executing **Retrieve** step.
  - `context.result`: The corresponding `Result` object.
- `afterAllRetrieves(context)`: The method after executing **Retrieve** step.
  - `context.result`: The corresponding `Result` object.

### Test Object

A standard `Test` object contains the following properties:

(You can refer to `examples/tests.json` for an example.)

- `selected` <boolean>: Whether to perform **Run** for this `Test`.
- `label` <string>: Name of this `Test`.
- `url` <string>: URL to audit.
- `recurring`: Settings for recurring audit.
  - `frequency` <string>: The frequency string defined in
   `src/common/frequency.js`. E.g. 'Daily', 'Weekly' or 'Monthly'.

Gatherer-specific settings will be in their own property with the Gatherer's
name in lower case. For example, the settings for *WebPageTests* will be:

- `webpagetest`
  - `settings`: Setting object contains audit location, connection, etc.
  - `metadata`: Metadata object contains WebPageTests's ID, JSON URL, etc.

### Result Object

A standard `Result` object contains the following properties:

- `selected` <boolean>: Whether to perform **Retrieve** for this `Result`.
- `id` <string>: Auto-generated unique ID for this `Result`.
- `type` <string>: `Single` or `Recurring` audit.
- `status` <string>: `Submitted`, `Retrieved` or `Error`.
Refer to `src/common/status.js` for details.
- `label` <string>: String label for this `Result`. This label inherits from its
original `Test` object.
- `url` <string>: Audited URL.
- `createdTimestamp` <string>: When this `Result` is created.
- `modifiedTimestamp` <string>: When this `Result` is last modified.

### Standardized Metrics

All metric names used in AWP are required to follow the names below, case
sensitive.

- **Timing metrics**
  - `TimeToFirstByte`
  - `FirstPaint`
  - `FirstMeaningfulPaint`
  - `FirstContentfulPaint`
  - `VisualComplete`
  - `SpeedIndex`
  - `DOMContentLoaded`
  - `LoadEvent`
  - `TimeToInteractive`
  - `TotalBlockingTime`
  - `FirstCPUIdle`
  - `FirstInputDelay`
  - `LargestContentfulPaint`

- **Resource Size**
  - `HTML`
  - `Javascript`
  - `CSS`
  - `Fonts`
  - `Images`
  - `Videos`

- **Resource Count**
  - `DOMElements`
  - `Connections`
  - `Requests`

- **Resource Scores**
  - `Performance`
  - `ProgressiveWebApp`

## Source Folder Structure

All source codes for major functions are located in `src` folder. Files are
organized into the following subfolders:

- `common`: Common classes and definitions, such as Status, Frequency, Metrics, etc.
- `connectors`: Connector classes.
- `extensions`: Extension classes.
- `gatherers`: Gatherer classes.
- `fakedata`: JSON files for unit tests.
- `utils`: Utilities and tools.

## Unit Test

Run the following commands to run unit test:

```
npm test
```

To run individual test spec, you can install Jest NPM module to your local
machine:

```
npm install -g jest
jest test/some-module.test.js
```

### Unit Test Design

The Unit Test is based on [Jest](https://jestjs.io/) unit test framework. All
unit tests are located in the `./test` folder, and are organized into its own
corresponding subfolders, as the same structure as in the `src` folder.

## Resources

TBD
