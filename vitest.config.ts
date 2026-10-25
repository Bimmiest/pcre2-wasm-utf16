import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node by default. A test that needs a DOM opts in per file with a
    // `// @vitest-environment jsdom` pragma, once jsdom is a devDependency.
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // Every test starts from a clean slate: a spy, a stubbed global or an env
    // var one test set never reaches the next.
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: 'v8',
      // Text for a local run, lcov for anything that ingests it, and
      // json-summary so the shared coverage-ratchet can read the numbers back
      // without re-running.
      reporter: ['text', 'lcov', 'json-summary'],
      // `include` covers every source file, not only the imported ones, so a
      // file with no test counts as 0% rather than being absent. An untested
      // file is exactly what a floor exists to notice.
      include: ['src/**/*.ts'],
      // Each exclusion carries its reason. Nothing is excluded to flatter the
      // numbers.
      exclude: [
        // The tests themselves, and the shared scaffolding they import.
        'src/**/*.test.ts',
        'src/test/**',
      ],
      // The floor lives here rather than in a CI flag, so `npm run
      // test:coverage` locally gives the same verdict CI does.
      //
      // Measured, not chosen: each floor is the suite's figure rounded down to
      // a whole percent, and CI's coverage-ratchet fails when a measurement
      // rises more than a point above its floor, printing the block to paste.
      // Raise a floor in the same change that raises coverage; never lower one
      // to make a branch green.
      //
      // Measured on 2026-10-25, when the suite moved from node:test to
      // Vitest: 99.64% of statements, 98.3% of branches, 100% of functions
      // and 100% of lines. What is left is in errorMessage(): a failed
      // allocation of the 256-unit buffer, and an error code that PCRE2 has
      // no text for. No test can cause either (docs/testing.md).
      thresholds: {
        statements: 99,
        branches: 98,
        functions: 100,
        lines: 100,
      },
    },
  },
});
