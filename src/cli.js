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
  single\t\tRun a single audit.
  tests\t\tThe JSON file with the URL list for audit.
  results\t\tThe output JSON file for writing test results.
  extensions\t\tComma-separated list of extensions.
  debug\t\tPrint out debug console logs.

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
  let extensions = argv['extensions'] ? argv['extensions'].split(',') : [];
  let debug = argv['debug'];

  if (!action) {
    printUsage();
    return;
  }

  console.log(extensions);

  let awp = new AutoWebPerf({
    tests: argv['tests'],
    results: argv['results'],
    connector: 'JSON',
    helper: 'Node',
    extensions: extensions,
    debug: debug,
  });

  switch(action) {
    case 'run':
      await awp.run({
        single: argv['single'],
        debug: debug,
      });
      break;

    case 'recurringActivate':
      await awp.recurring({
        activateOnly: true,
        debug: debug,
      });
      break;

    case 'recurring':
      await awp.recurring({
        debug: debug,
      });
      break;

    case 'retrieve':
      await awp.retrieve({
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
