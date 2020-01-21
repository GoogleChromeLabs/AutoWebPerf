import commonjs from 'rollup-plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default [
  {
    input: 'src/core.js',
    output: {
      file: 'build/bundle.js',
      format: 'cjs',
      esModule: false,
    },
    plugins: [
      commonjs({
        exclude: [
          'node_modules/**',
        ],
      }),
      resolve(),
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
