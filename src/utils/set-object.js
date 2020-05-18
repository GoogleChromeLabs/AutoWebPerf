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

function setObject(obj, path, value) {
  if (!path) return;

  let properties = path.split('.');
  let len = properties.length;
  let previousObj;

  for (let i = 0; i < len; i++) {
    let property = properties[i];
    let match = property.match(/(\w+)\[(\d+)\]/i);
    previousObj = obj;

    // Support patterns like a.b[0].c
    // TODO: support nested arrays like a.b[0][1]
    if (match) {
      property = match[1];
      let index = match[2];
      obj[property] = obj[property] || [];
      if (index) {
        obj[property][index] = obj[property][index] || {};
        obj = obj[property][index];
      } else {
        // Push empty object to the array ifno index in the proprety.
        // For example: a.b[].c
        obj[property].push({});
        obj = obj[property][obj[property].length - 1];
      }
    } else {
      obj[property] = obj[property] || {};
      obj = obj[property];
    }
  }

  if (previousObj) {
    eval(`previousObj.${properties[len - 1]} = value;`);
  }
}

module.exports = setObject;
