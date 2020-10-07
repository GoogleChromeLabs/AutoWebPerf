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

const assert = require('../utils/assert');
const Connector = require('./connector');

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 */
class MultiConnector extends Connector {
  constructor(config, apiHandler, envVars, testsConnector, resultsConnector) {
    super(config, apiHandler, envVars);
    this.apiHandler = apiHandler;

    this.testsConnector = testsConnector;
    this.resultsConnector = resultsConnector;
  }

  getEnvVars() {
    return this.testsConnector.getEnvVars();
  }

  getTestList(options) {
    return this.testsConnector.getTestList(options);
  }

  updateTestList(newTests, options) {
    return this.testsConnector.updateTestList(newTests, options);
  }

  getResultList(options) {
    return this.resultsConnector.getResultList(options);
  }

  appendResultList(newResults, options) {
    return this.resultsConnector.appendResultList(newResults, options);
  }

  updateResultList(newResults, options) {
    return this.resultsConnector.updateResultList(newResults, options);
  }
}

module.exports = MultiConnector;
