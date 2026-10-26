# 0003. The package adopts the template, and keeps its own build

- **Status:** Accepted
- **Date:** 2026-10-25
- **Issue:** [#7](https://github.com/Bimmiest/pcre2-wasm-utf16/issues/7)

## Context

This repository came from `propslab` before `repo-template` existed. It had
its own CI, `node:test`, ESLint with `recommendedTypeChecked`, and no
Prettier. [ADR 0001](0001-conventions-come-from-the-template-and-the-shared-workflows.md)
makes the template and `shared-workflows` the source of the conventions.

Four facts about this package do not agree with the template as written:

- The template builds `src/` to `dist/`. This package ships its TypeScript
  source (`exports` is `./src/index.ts`), and each consumer compiles it.
- The template has no committed binary. This package commits `pcre2.wasm`,
  and CI must prove that the file comes from the source.
- The template says that a tag starts nothing. Here, consumers install a tag
  (`github:Bimmiest/pcre2-wasm-utf16#v0.1.0`), so a tag is the release.
- `engines` in the template holds contributors to the Node of `.nvmrc`. Here,
  `engines` is also what each consumer's npm reads.

## Decision

- The repository uses the template's files, gates and shared checks, pinned
  to a commit of `shared-workflows`.
- The tests move from `node:test` to Vitest, next to the code in `src/`.
  `package.json` keeps them out of the package with `!src/**/*.test.ts`.
  They keep `node:assert/strict`, and ESLint accepts `assert.*` as an
  assertion.
- `npm run build` type-checks the shipped source with `tsconfig.build.json`:
  no tests, no Node types and only ES2022. It emits nothing.
- CI keeps three checks of its own: `check:package` in `verify`, the `wasm`
  job that rebuilds the module, and the mutation workflow.
- The ten `!` in `src/index.ts` that came before `strictTypeChecked` go on
  `scripts/lint-allowlist.json`. A test holds the counts.
- `engines` stays at `>=22.6.0`. The library uses no Node API, so a higher
  floor stops consumers for no reason.
- A pushed tag is the release, and a ruleset stops each `v*` tag from a
  move or a delete.

## Consequences

- The package uses the same gates as the other repositories, and a fix to a
  shared check gets here with a pin bump.
- A Node global or a DOM global in `src/index.ts` fails the build and lint.
  Before, only lint found it.
- The `!` allowlist hides those ten lines from `npm run lint`. The test
  finds a new `!` in `src/index.ts`, but only when the test suite runs.
- The suite takes a few seconds more under Vitest than under `node:test`.
- What to check when you change it: if the package starts to ship compiled
  JavaScript, `build` emits to `dist/`, `exports` points there, and this
  record is superseded.
