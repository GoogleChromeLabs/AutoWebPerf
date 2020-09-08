module.exports = {
  connector: 'JSON',
  helper: 'Node',
  gatherers: ['webpagetest', 'psi', 'cruxapi', 'cruxbigquery'],
  extensions: ['budgets'],
  json: { // Configuring JSON connector.
    tests: argv['tests'],
    results: argv['results'],
  },
  verbose: true,
  debug: false,
};
