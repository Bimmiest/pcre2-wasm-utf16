// @ts-check
// Mutation testing: `npm run test:mutation`. Coverage says which lines ran;
// this says whether any test would notice one of them being wrong. See
// CONTRIBUTING.md for how to read a run and when CI runs it.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  // node:test has no Stryker runner, so each mutant runs the whole suite as a
  // command. The suite takes well under a second, which keeps that affordable.
  testRunner: 'command',
  // One test file at a time: Stryker already runs a mutant per core, and a
  // process per file on top of that starves them into false timeouts.
  commandRunner: { command: 'node --test --test-concurrency=1 test/*.test.ts' },
  coverageAnalysis: 'off',

  mutate: ['src/**/*.ts'],

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
  // 90.9% on CI when set (326 killed, 23 timed out, 35 survived). Every
  // survivor is a mutant no test can tell apart from the original;
  // CONTRIBUTING.md says which kinds they are.
  thresholds: { high: 95, low: 90, break: 90 },
};
