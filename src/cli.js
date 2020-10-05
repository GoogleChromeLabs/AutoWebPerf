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

const AutoWebPerf = require('./awp-core');
const argv = require('minimist')(process.argv.slice(2));
const assert = require('./utils/assert');
const {NodeHelper} = require('./helpers/node-helper');

const printUsage = () => {
  let usage = `
Usage: ./awp [ACTION] [OPTIONS...]

Available Actions:
  run\t\tExecute audits from the test list.
  recurringActivate\tUpdate test frequency and timestamps.
  recurring\t\tExecute recurring audits from the test list.
  retrieve\tRetrieve test results from the results list.

Options (*denotes default value if not passed in):
  tests\t\tThe JSON file with the URL list for audit.
  results\t\tThe output JSON file for writing test results to. By default, it will overrides the existing results list.
  gatherers\t\ttComma-separated list of data sources. Default: webpagetest.
  extensions\t\tComma-separated list of extensions.
  selectedOnly\t\tOnly execute with tests or results with selected=true.
  config\t\tLoad a custom awpConfig. See examples/awp-config.json for example.
  verbose\t\tPrint out verbose logs.
  debug\t\tPrint out debug console logs.

Examples:
  # List CLI options
  ./awp --help

  # Run tests
  ./awp run --tests=examples/tests.json --results=tmp/results.json

  # Run recurring tests
  ./awp recurring --tests=examples/tests-recurring.json --results=tmp/results.json

  # Activate recurring tests without running actual tests.
  ./awp recurringActivate --tests=examples/tests-recurring --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Retrieve pending results (For WebPageTest usage)
  ./awp retrieve --tests=examples/tests-wpt.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Retrieve results from CrUX API
  ./awp run --tests=examples/tests-cruxapi.json --results=tmp/results.json --envVars=cruxApiKey=SAMPLE_APIKEY

  # Retrieve historical CrUX via BigQuery in runByBatch mode
  ./awp run --tests=examples/tests-cruxbigquery.json --results=tmp/results.json --runByBatch --envVars=gcpKeyFilePath=KEY_PATH,gcpProjectId=PROJECT_ID

  # Run with multiple connectors: tests from local JSON and writes results to BigQuery.
  ./awp run --tests=csv:examples/tests.csv --results=json:tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Run tests with budget extension
  ./awp run --tests=examples/tests.json --results=tmp/results.json --extensions=budgets

  # Run with a custom awpConfig.
  ./awp run --config=examples/awp-config.json

  `;
  console.log(usage);
}

/**
 * Helper function for parsing envVars.
 * @param {string} varString Variable strings in the format of "a=1,b=2"
 */
const parseVars = (varString) => {
  if (!varString) return null;

  let keyValues = {};
  let varPairs = varString.split(',');
  varPairs.forEach(varPair => {
    [key, value] = varPair.split('=');
    keyValues[key] = value;
  });
  return keyValues;
}

/**
 * Main CLI function.
 */
async function begin() {
  let action = argv['_'][0], output = argv['output'];
  let testsPath = argv['tests'];
  let resultsPath = argv['results'];
  let config = argv['config'];
  let appendResults = argv['append-results'];
  let gatherers = argv['gatherers'] ? argv['gatherers'].split(',') : null;
  let extensions = argv['extensions'] ? argv['extensions'].split(',') : [];
  let runByBatch = argv['runByBatch'] ?  true : false;
  let envVars = parseVars(argv['envVars']);
  let debug = argv['debug'];
  let verbose = argv['verbose'];
  let filters = [], awpConfig;

  // Assert mandatory parameters
  if (!action) {
    printUsage();
    return;
  }

  if (config) {
    awpConfig = NodeHelper.getJsonFromFile(config);

  } else {
    assert(testsPath, `'tests' parameter is missing.`);
    assert(resultsPath, `'results' parameter is missing.`);

    if (argv['selectedOnly']) filters.push('selected');

    // Parse connector names.
    let testsConnector = 'json', resultsConnector = 'json', connector, path;
    [connector, path] = argv['tests'].split(':');
    if (path) {
      testsConnector = connector;
      testsPath = path;
    }
    [connector, path] = argv['results'].split(':');
    if (path) {
      resultsConnector = connector;
      resultsPath = path;
    }

    // Construct overall AWP config and individual connector's config.
    awpConfig = {
      tests: {
        connector: testsConnector,
        path: testsPath,
      },
      results: {
        connector: resultsConnector,
        path: resultsPath,
        appendResults: appendResults,
      },
      helper: 'node',
      gatherers: gatherers || ['webpagetest', 'psi', 'cruxbigquery', 'cruxapi'],
      extensions: extensions,
      envVars: envVars,
      verbose: verbose,
      debug: debug,
    };
  }

  if (verbose) {
    console.log('Use awpConfig:');
    console.log(JSON.stringify(awpConfig, null, 2));
  }

  // Create AWP instance.
  let awp = new AutoWebPerf(awpConfig);

  let options = {
    filters: filters,
    runByBatch: runByBatch,
    verbose: verbose,
    debug: debug,
  };

  switch(action) {
    case 'run':
      await awp.run(options);
      break;

    case 'recurringActivate':
      options.activateOnly = true;
      await awp.recurring(options);
      break;

    case 'recurring':
      await awp.recurring(options);
      break;

    case 'retrieve':
      await awp.retrieve(options);
      break;

    default:
      printUsage();
      break;
  }
}

module.exports = {
  begin,
};
