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

function printUsage() {
  let usage = `
Usage: ./awp [ACTION] [OPTIONS...]

Available Actions:
  run\t\tExecute audits from the test list.
  recurringActivate\tUpdate test frequency and timestamps.
  recurring\t\tExecute recurring audits from the test list.
  retrieve\tRetrieve test results from the results list.

Options (*denotes default value if not passed in):
  tests\t\tThe JSON file with the URL list for audit.
  results\t\tThe output JSON file for writing test results.
  gatherers\t\ttComma-separated list of data sources. Default: webpagetest.
  extensions\t\tComma-separated list of extensions.
  selectedOnly\t\tOnly execute with tests or results with selected=true.
  verbose\t\tPrint out verbose logs.
  debug\t\tPrint out debug console logs.

Examples:
  # List CLI options
  ./awp --help

  # Run tests
  ./awp run --tests=examples/tests.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Run recurring tests
  ./awp recurring --tests=examples/tests.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Activate recurring tests without running actual tests.
  ./awp recurringActivate --tests=examples/tests.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # Retrieve pending results (For WebPageTest usage)
  ./awp retrieve --tests=examples/tests.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY

  # CrUX API runByBatch
  ./awp run --tests=examples/tests-cruxapi.json --results=tmp/results.json --envVars=cruxApiKey=SAMPLE_APIKEY

  # CrUX BigQuery Test runByBatch
  ./awp run --tests=examples/tests-cruxbigquery.json --results=tmp/results.json --runByBatch --envVars=gcpKeyFilePath=KEY_PATH,gcpProjectId=PROJECT_ID

  # Run with verbose or debug.
  ./awp run --tests=examples/tests.json --results=tmp/results.json --envVars=psiApiKey=SAMPLE_APIKEY --verbose --debug

  `;
  console.log(usage);
}

/**
 * Main CLI function.
 */
async function begin() {
  let action = argv['_'][0], output = argv['output'];
  let gatherers = argv['gatherers'] ? argv['gatherers'].split(',') : null;
  let extensions = argv['extensions'] ? argv['extensions'].split(',') : [];
  let runByBatch = argv['runByBatch'] ?  true : false;
  let envVarsArray = argv['envVars'] ? argv['envVars'].split(',') : null;
  let envVars = {};
  let debug = argv['debug'];
  let verbose = argv['verbose'];

  // Parsing envVar string into key-value envVars object.
  if (envVarsArray) {
    envVarsArray.forEach(envVarStr => {
      [key, value] = envVarStr.split('=');
      envVars[key] = value;
    });
  }

  let filters = [];
  if (argv['selectedOnly']) filters.push('selected');

  if (!action) {
    printUsage();
    return;
  }

  let awp = new AutoWebPerf({
    connector: 'JSON',
    helper: 'Node',
    gatherers: gatherers || ['webpagetest', 'psi', 'cruxbigquery', 'cruxapi'],
    extensions: extensions,
    json: { // Config for JSON connector.
      testsJsonPath: argv['tests'],
      resultsJsonPath: argv['results'],
    },
    envVars: envVars,
    verbose: verbose,
    debug: debug,
  });

  let options = {
    filters: filters,
    runByBatch: runByBatch,
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
