---
type: reference
---

# Testing

This file gives the rules for tests, with their reasons. It also tells you
what each test file tests, how to explore the property tests further, and how
to read a mutation run. CONTRIBUTING.md has the summary.

## The rules

- Use Vitest, with the `node` environment, and put each `*.test.ts` file
  next to the code that it tests. A test that needs a DOM selects it in its
  own file. `package.json` keeps the tests out of the package.
- The tests use `node:assert/strict` or `expect`. Lint accepts both as an
  assertion ([ADR 0003](adr/0003-the-package-adopts-the-template-and-keeps-its-own-build.md)).
- Each test file has its own module graph. Thus a file that calls `init`,
  or that patches a global, does not change another file.
  [The test files](#the-test-files) tells you what each file tests.
- **The coverage floor is a ratchet, in both directions.** `vitest.config.ts`
  fails a run that is below the floor. CI's coverage ratchet fails a run that
  is more than one point above the floor, and prints the thresholds to
  write. Raise a floor in the change that raises the coverage. Do not lower
  a floor to make a branch green. Do not exclude code to make the numbers
  look better. Each exclusion has its reason next to it.
- **Lint checks what makes a test a test.** These fail lint: a case with no
  assertion, two cases with one name, and an `expect` that is not finished
  or not awaited. Give a helper that asserts for the test a name
  that starts with `expect`.
- **A test does not measure its own time.** Do not use `performance.now()`,
  `Date.now()` or `toBeLessThan(<ms>)` in a unit test. A wall-clock
  assertion passes on a fast machine and fails on the CI runner. Count the
  work instead, or make the input so large that the bad version cannot
  finish within the timeout. To prove that a new bound works, put the bug
  back once and see the test fail.
- **Share the test helpers.** Keep one builder for each domain object in
  `src/test/`. A new test file uses those builders, not its own literals.
- **CI checks the order and the environment of the tests.** Each week, CI
  runs the suite in a random order, in a different time zone and locale. It
  prints the seed and the command that runs the same order again. A test
  that passes only in alphabetical order and in UTC does not test what it
  claims.
- **Mutation testing** is for code where a wrong answer is silent. Here,
  that is all of `src/index.ts`. Stryker runs over that code each week, and
  on a pull request that changes `src/`. Its floor is a ratchet, like the coverage
  floor, and it does not block pull requests. A mutant that survives is a
  test to write, or an equivalent mutant that you record with its reason.
  Kill a mutant with a test that asserts behaviour, not with a test that
  only moves the number. [Mutation testing](#mutation-testing) lists
  the survivors that no test can kill.

## The test files

| File | What it tests |
|---|---|
| `src/regex.test.ts` | An example for each part of the API, and for the PCRE semantics that the JS `RegExp` does not have |
| `src/properties.test.ts` | Property-based tests with [fast-check](https://fast-check.dev), against generated patterns and subjects |
| `src/memory.test.ts` | Leaks of wasm memory, and the finalizer |
| `src/finalizer.test.ts` | The finalizer after a second `init`: a collected `Regex` from the old instance frees nothing in the new one |
| `src/uninitialised.test.ts` | The API before `init` runs |
| `scripts/lint-allowlist.test.mjs` | The counts in `scripts/lint-allowlist.json` against the findings of each rule |

## Property tests

One property compares the first match with the JS `RegExp`. It uses a
generated grammar of the constructs on which the specifications of the two
engines agree. The comments in the file tell you what the grammar leaves out,
and why.

The other properties check invariants over a wider grammar:

- The text of a match is its span of the subject.
- No offset splits a surrogate pair.
- `substitute` and `replace` replace the same matches.
- A subject in the cache does not go into a later call.

The seed is fixed, so CI is deterministic. To explore more inputs, set the
seed and the number of runs:

```bash
FC_SEED=12345 FC_RUNS=5000 npx vitest run src/properties.test.ts
```

A failure prints the seed and the path that make it again.

## Memory tests

The garbage collector does not see wasm memory, so a missed free is a leak
that nothing else reports. `src/memory.test.ts` puts a wrapper on
`WebAssembly.Instance` before the library loads, and so finds the memory of
the module. Then it repeats each operation thousands of times, and fails if
the memory grows. It also starts collections, to prove that the finalizer
frees an abandoned `Regex` one time only. `src/test/gc.ts` starts the
collections, for this file and for `src/finalizer.test.ts`.

## Coverage

The floors are in `vitest.config.ts`, with the date of the measurement. The
statement and the branches that no test reaches are in `errorMessage()`: a
failed allocation of the message buffer, and an error code that PCRE2 has no
text for.

## Mutation testing

`npm run test:mutation` runs [Stryker](https://stryker-mutator.io) with the
Vitest runner. Stryker makes one small change to `src/index.ts` at a time,
and checks that a test fails. `mutation.yml` runs it each week, and on a pull
request that changes `src/`, the Vitest config or the Stryker config. It is
not a required check.

The run fails below the floor in `stryker.config.mjs`. The HTML report is an
artifact of the run, for 14 days. The config has the last measurement.

A mutant that survives is a missing test, or a mutant that no test can tell
apart from the original. When the floor was set, each survivor was one of
these kinds:

- **Bounds that make no difference.** An index one past the end of a typed
  array, or `charCodeAt` out of range, gives `NaN` or is ignored. Thus `<`
  and `<=` behave the same.
- **Unreachable branches.** A failed allocation of the 256-unit error buffer,
  an error code that PCRE2 has no text for, `rc === 0` from a match, and two
  replacement error codes that the wrapper cannot cause.
- **Performance, not behaviour.** A buffer that is a little smaller, a
  reallocation that was not necessary, or a state read that is then ignored.

If a new survivor is not one of these kinds, write the test that kills it.
