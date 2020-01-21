import commonjs from 'rollup-plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import buble from '@rollup/plugin-buble';
import replace from '@rollup/plugin-replace';
import visualizer from 'rollup-plugin-visualizer';
import builtins from 'builtin-modules'

export default [
  {
    input: 'src/core.js',
    output: {
      file: 'build/bundle.js',
      format: 'cjs',
      esModule: false,
    },
    external: builtins,
    plugins: [
      commonjs({
        exclude: [
          'node_modules/**',
        ],
        ignoreGlobal: false,
        ignore: [
          'path',
          'fs-extra',
          'sync-request',
          './connectors/json-connector',
          './helpers/node-helper',
        ],
      }),
      resolve(),
      visualizer(),
    ]
  },
  // {
  //   input: 'src/core.js',
  //   output: {
  //     file: 'build/vendor.js',
  //     format: 'cjs',
  //     name: 'vendor'
  //   },
  //   plugins: [
  //     commonjs(),
  //     resolve({
  //       only: [
  //         'node_modules',
  //       ]
  //     }),
  //   ]
  // }
];
