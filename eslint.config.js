import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  // Generated: coverage and mutation reports, and Stryker's sandbox.
  globalIgnores(['coverage', 'reports', '.stryker-tmp']),
  {
    files: ['**/*.{js,mjs,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022 },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      // Type-aware linting through the tsconfig that owns each file, so the
      // lint and `npm run typecheck` agree on types.
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // The library runs in browsers, workers and Node alike, so it may use no
    // environment's globals: WebAssembly is reached through globalThis and
    // typed locally (see the top of src/index.ts).
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.es2022 },
  },
  {
    // Tests, config and scripts run under Node only.
    files: ['test/**/*.ts', '*.js', '*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.es2022, ...globals.node } },
  },
  {
    // node:test's test() returns a promise the runner itself awaits; the
    // tests call it at top level, as node:test intends.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]);
