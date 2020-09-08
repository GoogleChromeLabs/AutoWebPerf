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

// Connectors
require('../src/connectors/appscript-connector');

// Extensions
require('../src/extensions/appscript-extension');
require('../src/extensions/budgets-extension');

// Gatherers
require('../src/gatherers/webpagetest');
require('../src/gatherers/psi');
require('../src/gatherers/cruxapi');
require('../src/gatherers/cruxbigquery');

// Helpers
require('../src/helpers/appscript-helper');
require('../src/helpers/gcp-handler');

// Core
const AutoWebPerf = require('../src/awp-core');

module.exports = AutoWebPerf;
