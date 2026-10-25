// @ts-check
// Mutation testing: `npm run test:mutation`. Coverage says which lines ran;
// this says whether any test would notice one of them being wrong. See
// docs/testing.md for how to read a run and when CI runs it.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // The Vitest runner reads which tests cover each mutant, and runs only those
  // tests for it, in a worker that it keeps between mutants.
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  coverageAnalysis: 'perTest',

  // The library, not the tests that sit next to it.
  mutate: ['src/**/*.ts', '!src/**/*.test.ts', '!src/test/**'],

  // A mutant that makes the suite hang is killed by timing out, after the
  // suite's own time times this factor plus timeoutMS. Stryker's default
  // factor (1.5) is too tight when a mutant runs on every core at once: the
  // memory and limit tests slow each other down, and a mutant that survives is
  // then counted as a timeout, which inflates the score.
  timeoutFactor: 3,

  reporters: ['clear-text', 'progress', 'html', 'json'],
  tempDirName: '.stryker-tmp',

  // `break` is the floor: below it the run exits non-zero, which fails the
  // mutation workflow. Measured, not chosen; raise it when tests raise the
  // score, never lower it to make a branch green.
  // 90.9% on CI when set, with the command runner. 90.36% on 2026-10-25 with
  // the Vitest runner, on four cores in 4.5 minutes: 329 killed, 18 timed
  // out, 35 survived, and 2 with no coverage (the two unreachable messages
  // in errorMessage()). docs/testing.md lists the kinds of survivor that no
  // test can kill.
  thresholds: { high: 95, low: 90, break: 90 },
};
