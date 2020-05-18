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
  dataSources\t\ttComma-separated list of data sources. Default: webpagetest.
  extensions\t\tComma-separated list of extensions.
  selectedOnly\t\tOnly execute with tests or results with selected=true.
  verbose\t\tPrint out verbose logs.
  debug\t\tPrint out debug console logs.

Examples:
  # List CLI options
  ./awp --help

  # Run tests
  ./awp run --tests=examples/tests.json --results=output/results.json

  # Run recurring tests
  ./awp recurring --tests=examples/tests.json --results=output/results.json

  # Retrieve pending results
  ./awp retrieve --tests=examples/tests.json --results=output/results.json
  `;
  console.log(usage);
}

/**
 * Main CLI function.
 */
async function begin() {
  let action = argv['_'][0], output = argv['output'];
  let dataSources = argv['dataSources'] ? argv['dataSources'].split(',') : null;
  let extensions = argv['extensions'] ? argv['extensions'].split(',') : [];
  let debug = argv['debug'];
  let verbose = argv['verbose'];

  let filters = [];
  if (argv['selectedOnly']) filters.push('selected');

  if (!action) {
    printUsage();
    return;
  }

  let awp = new AutoWebPerf({
    connector: 'JSON',
    helper: 'Node',
    dataSources: dataSources || ['webpagetest', 'psi', 'chromeuxreport'],
    extensions: extensions,
    json: { // Config for JSON connector.
      tests: argv['tests'],
      results: argv['results'],
    },
    verbose: verbose,
    debug: debug,
  });

  switch(action) {
    case 'run':
      await awp.run({
        filters: filters,
        debug: debug,
      });
      break;

    case 'recurringActivate':
      await awp.recurring({
        activateOnly: true,
        filters: filters,
        debug: debug,
      });
      break;

    case 'recurring':
      await awp.recurring({
        filters: filters,
        debug: debug,
      });
      break;

    case 'retrieve':
      await awp.retrieve({
        filters: filters,
        debug: debug,
      });
      break;

    default:
      printUsage();
      break;
  }
}

module.exports = {
  begin,
};
