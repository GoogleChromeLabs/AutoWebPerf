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
const setObject = require('../utils/set-object');
const Connector = require('./connector');

/**
 * the connector handles read and write actions with local JSON files as a data
 * store. This connector works together with `src/helpers/node-helper.js`.
 * 
 * Usage example:
 * 
 * ./awp run --gatherer=psi url:https://web.dev json:output/results.json
 */
class URLConnector extends Connector {
  constructor(config, apiHandler, envVars) {
    super(config, apiHandler, envVars);
  }
  
  /**
   * Get all tests.
   * @param  {Object} options
   * @return {Array<Object>} Array of Test objects.
   */
  getTestList(options) {
    return [{
      label: this.testsPath,
      url: this.testsPath,
      gatherer: options.gatherer || 'psi',
    }];
  }
  
  getEnvVars() {}
  updateTestList(newTests, options) {}
  getResultList(options) {}
  appendResultList(newResults, options) {}
  updateResultList(newResults, options) {}
}

module.exports = URLConnector;
