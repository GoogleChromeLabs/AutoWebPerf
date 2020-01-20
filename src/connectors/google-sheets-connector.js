'use strict';

const fse = require('fs-extra');
const path = require('path');
const assert = require('assert');
const Connector = require('./connector');

class GoogleSheetConnector extends Connector {
  constructor(config) {
    super();
    assert(config.tests, 'tests is missing in config.');
    assert(config.results, 'results is missing in config.');

    this.tests = config.tests;
    this.results = config.results;
  }

  getTestList() {
    let rawdata = fse.readFileSync(this.tests);
    return JSON.parse(rawdata).testList;
  }

  updateTestList(tests) {

  }

  getResultList() {
    try {
      let filepath = path.resolve(`./output/${this.results}`);
      if (fse.existsSync(filepath)) {
        let rawdata = fse.readFileSync(filepath);
        return JSON.parse(rawdata).results;
      }
      return [];
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  appendResultList(newResults) {
    let results = this.getResultList();
    let filepath = path.resolve(`./output/${this.results}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results.concat(newResults),
      }, null, 2));
  }

  updateResultList(results) {
    let filepath = path.resolve(`./output/${this.results}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results,
      }, null, 2));
  }
}

module.exports = GoogleSheetConnector;
