import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'

const baseConfig = {
  external: ['ethers', 'defender-relay-client'],
  plugins: [
    nodeResolve(),
    commonjs(),
    json()
  ]
}

export default [
  {
    ...baseConfig,
    input: 'src/autotask.js',
    output: {
      file: 'dist/autotask-bundle.js',
      format: 'cjs',
      exports: 'named'
    }
  }
]
