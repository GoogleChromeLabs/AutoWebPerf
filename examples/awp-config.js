module.exports = {
  connector: 'JSON',
  helper: 'Node',
  dataSources: ['webpagetest', 'psi'],
  extensions: [
    'budgets',
  ],
  json: { // Configuring JSON connector.
    tests: argv['tests'],
    results: argv['results'],
  },
  budgets: {
    dataSource: 'webpagetest',
  },
  verbose: true,
  debug: false,
};
