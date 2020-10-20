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

class Gatherer {
  /**
   * constructor
   * @param  {object} config The config object specific for the gatherer.
   * @param  {object} envVars The object of all environment variables.
   * @param  {object} apiHandler API handler instance.
   * @param  {object} options Options object.
   */
  constructor(config, envVars, apiHandler, options) {}

  /**
   * Run a single Test.
   * @param  {object} test A Test object.
   * @param  {object} options Options object.
   * @return {object} Response object, including status proeprty.
   */
  run(test, options) {
    return null; // Return null by default.
  }

  /**
   * Run a list of Tests in batch.
   * @param  {Array<object>} tests List of Test objects.
   * @param  {object} options Options object.
   * @return {object} Response object, including status proeprty.
   */
  async runBatchAsync(tests, options) {
    return null; // Return null by default.
  }

  /**
   * Rtrieve a single Result.
   * @param  {object} result A Result object.
   * @param  {object} options Options object.
   * @return {object} Response object, including status proeprty.
   */
  retrieve(result, options) {
    return null; // Return null by default.
  }

  /**
   * Retrieve a list of Results in batch.
   * @param  {Array<object>} results List of Result objects
   * @param  {object} options Options object.
   * @return {object} Response object, including status proeprty.
   */
  async retrieveBatchAsync(results, options) {
    return null; // Return null by default.
  }
}

module.exports = Gatherer;
