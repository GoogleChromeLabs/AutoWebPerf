# AutoWebPerf (AWP)

> AutoWebPerf automates web performance audits and collects multiple audit
sources including WebPageTest and PageSpeedInsight, with the support of running
recurring audits.

## TL;DR

- Using Lighthouse

## Getting Started

Clone this repo:

TBD

To run tests:
```
./awp run --tests=examples/tests.json --results=results.json
```

To run recurring tests:
```
./awp recurring --tests=examples/tests.json --results=results.json
```

To retrieve pending results:
```
./awp retrieve --tests=examples/tests.json --results=results.json
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
./awp run --tests=examples/tests.json --results=results.json
```

This will generate the result object(s) in the given path to `results.json`.

For some audit platforms like WebPageTest, each test may take a few minutes to
fetch actual results. For these type of *asynchronous* audits, each Result will stay in "Submitted" status. You will need to explicitly retrieve results later.

#### Retrieve test results

Run the following to retrieve the final metrics of results in the
`results.json`.

```
./awp retrieve --tests=examples/tests.json --results=results.json
```

This will fetch metrics for all audit platforms and update to the Result object
in the `output/results.json`. You can check out `examples/results.json` for
details in Result objects.

#### Run recurring tests

If you'd like to set up recurring tests, you can define the `recurring` object
that contains `frequency` for that Test.

```
./awp recurring --tests=examples/tests.json --results=results.json
```

This will generate the Result object in the `results.json` and updates the next
trigger time to its original Test object in the `tests.json`.

#### Run tests with extensions

```
./awp run --tests=examples/tests.json --results=results.json --extensions=budgets
```

### Using AWP With Google Sheets

TBD

### Using AWP with Google Cloud Platforms

TBD

## Design

### Standardized Metrics

The metric names used in AWP are case sensitive.

#### Timing metrics
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

#### Resource Size
- `HTML`
- `Javascript`
- `CSS`
- `Fonts`
- `Images`
- `Videos`

#### Resource Count
- `DOMElements`
- `Connections`
- `Requests`

#### Resource Scores
- `Performance`
- `ProgressiveWebApp`
