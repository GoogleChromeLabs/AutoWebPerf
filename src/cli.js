const AutoWebPerf = require('./core');
const argv = require('minimist')(process.argv.slice(2));

function printUsage() {
  let usage = `
Usage: ./awp [ACTION] [OPTIONS...]

Available Actions:
  run\t\tExecute audits for the URL list.
  retrieve\tRetrieve test results from the URL list.
  audit\t\tRun a single audit to a given URL.

Options (*denotes default value if not passed in):
  tests\t\tThe JSON file with the URL list for audit.
  results\t\tThe output JSON file for writing test results.

Examples:
  # ...
  `;
  console.log(usage);
}

/**
 * Main CLI function.
 */
async function begin() {
  let action = argv['_'][0], output = argv['output'];

  if (!action) {
    printUsage();
    return;
  }

  let awp = new AutoWebPerf({
    tests: argv['tests'],
    results: argv['results'],
  });

  switch(action) {
    case 'run':
      await awp.run();
      break;
    case 'retrieve':
      await awp.retrieve();
      break;
    default:
      printUsage();
      break;
  }
}

module.exports = {
  begin,
};
