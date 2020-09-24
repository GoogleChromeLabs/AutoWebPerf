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

const request = require('sync-request');
const ApiHandler = require('./api-handler');
const fse = require('fs-extra');
const path = require('path');

class NodeApiHandler extends ApiHandler {
  fetch(url) {
    return this.get(url);
  }

  get(url) {
    try {
      let response = request('GET', url);
  		return {
        statusCode: response.statusCode,
        body: response.getBody().toString(),
      }
    } catch (e) {
      return  {
        statusCode: e.code || 500,
        statusText: e.message,
        error: e,
      }
    }
  }

  post(url, postOptions) {
    try {
      let response = request('POST', url, postOptions);
      return {
        statusCode: response.statusCode,
        body: response.getBody().toString(),
      }
    } catch (e) {
      return  {
        statusCode: e.code || 500,
        statusText: e.message,
        error: e,
      }
    }
  }
}

NodeHelper = {
  getJsonFromFile: (filepath) => {
    return JSON.parse(fse.readFileSync(path.resolve(filepath)));
  }
}

module.exports = {
  NodeApiHandler,
  NodeHelper,
};
