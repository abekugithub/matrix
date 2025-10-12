import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/matrix-sdk-entry.js',
  // Important: ensure a single chunk (disable code splitting by avoiding dynamic imports)
  treeshake: true,
  output: {
    file: 'public/matrix-js-sdk.umd.min.js',
    format: 'umd', // produces window.matrixcs
    name: 'matrixcs',
    sourcemap: false,
    inlineDynamicImports: true // <- forces a single bundle (no code-splitting)
  },
  plugins: [
    resolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    json(),
    terser()
  ],
  onwarn(warning, warn) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      // SDK has legit circular deps; safe to ignore
      return;
    }
    warn(warning);
  }
};