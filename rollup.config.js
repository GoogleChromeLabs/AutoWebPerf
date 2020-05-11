import commonjs from 'rollup-plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from '@rollup/plugin-replace';
import visualizer from 'rollup-plugin-visualizer';
import builtins from 'builtin-modules'

export default [
  {
    input: 'src/awp-core.js',
    output: {
      file: 'build/bundle-googlesheets.js',
      format: 'cjs',
      esModule: false,
    },
    treeshake: false,
    plugins: [
      commonjs({
        ignore: [
          'sync-request',
          './connectors/json-connector',
          './helpers/node-helper',
          '@google-cloud/bigquery',
        ],
      }),
      babel({
        exclude: 'node_modules/**'
      }),
      resolve({
        preferBuiltins: false,
        jail: './src',
        dedupe: [],
      }),
      replace({
        // changed: 'module.exports = core;',
      }),
      visualizer(),
    ]
  },
];
