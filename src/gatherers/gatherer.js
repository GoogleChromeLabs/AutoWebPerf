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
  constructor(config, apiHelper, options) {}
  run(test, options) {
    return null; // Return null by default.
  }
  runBatch(tests, options) {
    return null; // Return null by default.
  }
  retrieve(result, options) {
    return null; // Return null by default.
  }
  retrieveBatch(results, options) {
    return null; // Return null by default.
  }
}

module.exports = Gatherer;
