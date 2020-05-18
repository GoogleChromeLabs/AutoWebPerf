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
    this.resultPath = config.results;

    this.testsData = JSON.parse(
        fse.readFileSync(path.resolve(`${this.tests}`)));
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
    let filepath = path.resolve(`${this.tests}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "config": this.testsData.config,
        "tests": newTests,
      }, null, 2));
  }

  getResultList() {
    try {
      let filepath = path.resolve(`${this.resultPath}`);
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
    let filepath = path.resolve(`${this.resultPath}`);
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

    let filepath = path.resolve(`${this.resultPath}`);
    fse.outputFileSync(
      filepath,
      JSON.stringify({
        "results": results,
      }, null, 2));
  }
}

module.exports = JSONConnector;
