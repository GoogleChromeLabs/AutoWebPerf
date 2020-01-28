'use strict';

const fse = require('fs-extra');
const path = require('path');
const assert = require('../utils/assert');
const Connector = require('./connector');

class JSONConnector extends Connector {
  constructor(config) {
    super();
    assert(config.tests, 'tests is missing in config.');
    assert(config.results, 'results is missing in config.');

    this.tests = config.tests;
    this.results = config.results;

    this.testsData = JSON.parse(
        fse.readFileSync(path.resolve(`./${this.tests}`)));
  }

  healthCheck() {

  }

  getConfig() {
    return this.testsData.config;
  }

  getTestList() {
    return this.testsData.tests;
  }

  updateTestList(newTests) {
    let filepath = path.resolve(`./${this.tests}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "config": this.testsData.config,
        "tests": newTests,
      }, null, 2));
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

  updateResultList(newResults) {
    let results = this.getResultList();
    let idToResults = {};

    newResults.forEach(result => {
      idToResults[result.id] = result;
    });

    results = results.map(result => {
      return idToResults[result.id] || result;
    });

    let filepath = path.resolve(`./output/${this.results}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results,
      }, null, 2));
  }
}

module.exports = JSONConnector;
