# Contributing

## Getting set up

Use the Node version in `.nvmrc`, then:

```sh
npm install
npm test
```

Rebuilding `pcre2.wasm` also needs clang 18 with the wasm32 target and
`wasm-ld` (Debian/Ubuntu: `clang-18 lld-18`). Nothing else does: the module is
committed.

## The CI checks

`ci.yml` runs these on every pull request and push to `main`, and weekly:

| Check | Command | What it guards |
|---|---|---|
| Lint | `npm run lint` | ESLint with typescript-eslint's type-checked rules. The library may use no environment's globals, so it runs in a browser, a worker and Node alike. |
| Type-check | `npm run typecheck` | `tsc` over `src` and `test`. |
| Tests, with coverage | `npm run test:coverage` | The tests below, failing under 100% of lines, 100% of functions or 98% of branches. |
| Package contents | `npm run check:package` | What `npm pack` ships, which is also what a git-dependency install receives. The licence files must be in it and development files must not. |
| Reproducible build | `npm run check:wasm` | Rebuilds `pcre2.wasm` from the pinned PCRE2 release and fails unless it is byte-identical to the committed file and its recorded SHA-256. The same build holds this repository's own C (`build/bridge.c`, `build/libc/`) to `-Wall -Wextra -Werror`. |
| Audit | `npm audit` | Fails on a high or critical advisory in a production dependency (there are none today), and reports dev-only ones without failing. |

The coverage floors are measured, not chosen. Raise them when tests raise
coverage, and never lower them to make a branch pass.

Mutation testing runs in its own workflow; see below.

## The tests

Each test file runs in its own process, so a file's module state (whether
`init` has run, a patched global) does not reach the others.

- `test/regex.test.ts`: an example for every part of the API, and for the PCRE
  semantics JavaScript's `RegExp` lacks.
- `test/properties.test.ts`: property-based tests with
  [fast-check](https://fast-check.dev). One compares first matches with
  JavaScript's `RegExp` over a generated grammar of the constructs the two are
  specified to agree on. The comments there say what the grammar leaves out
  and why. The others check invariants over a wider grammar: a match's text
  is its span, no offset splits a surrogate pair, `substitute` and `replace`
  replace the same matches, and a cached subject never leaks into a later
  call. The seed is fixed so CI is deterministic. `FC_SEED=<n>` and
  `FC_RUNS=<n>` explore further, and a failure prints the seed and path that
  reproduce it.
- `test/memory.test.ts`: leak checks. Wasm memory is invisible to the garbage
  collector, so this file watches the module's memory while repeating each
  operation thousands of times. It also forces collections, to check that the
  finalizer frees an abandoned `Regex` exactly once.
- `test/uninitialised.test.ts`: the API before `init` has run.

## Mutation testing

`npm run test:mutation` runs [Stryker](https://stryker-mutator.io): it changes
`src/` one small edit at a time and checks that some test fails. A full run takes
about four minutes on 16 cores and about ten on a hosted runner. `mutation.yml`
runs it weekly and on pull requests that change `src/`, `test/` or the Stryker
config. It fails below the floor in `stryker.config.mjs` (90%), and the HTML
report is uploaded as an artifact.

The score was 91.1% when the floor was set, and every survivor then was a
mutant that no test can tell apart from the original. They come in these
kinds:

- **Bounds that make no difference.** An index one past the end of a typed
  array, or `charCodeAt` out of range, gives `NaN` or is ignored, so `<` and
  `<=` behave the same.
- **Unreachable branches.** A failed allocation of a 256-byte error buffer, an
  error message PCRE2 has no text for, `rc === 0` from a match, and two
  replacement error codes the wrapper cannot trigger.
- **Performance, not behaviour.** A buffer sized a little smaller, reallocated
  when it did not need to be, or a state read that is then discarded.

A new survivor outside those kinds is a missing test.

## Changing the module

Edit `build/build.sh` or the C in `build/`, then:

```sh
npm run build:wasm
```

Commit `pcre2.wasm` and `pcre2.wasm.sha256` together. CI rebuilds with clang 18
and fails if the result differs, so the committed binary is always known to
come from the source.

For a PCRE2 upgrade, change `PCRE2_VERSION` and `PCRE2_SHA256` in
`build/build.sh` and check the release's `LICENCE.md` against
`LICENCE-PCRE2.md`, updating it and `NOTICE` if they differ. The version test in
`test/regex.test.ts` names the release it expects.

## Releasing

Consumers install a tag (`github:Bimmiest/pcre2-wasm-utf16#v0.1.0`), so pushing a
tag is releasing. To release:

1. In a pull request, move the `Unreleased` entries in `CHANGELOG.md` under the
   new version, and set that version in `package.json` with
   `npm version <x.y.z> --no-git-tag-version`.
2. Merge it once CI passes.
3. Tag the merge commit on `main`, push the tag, and create the release:

   ```sh
   git tag -a v<x.y.z> -m "v<x.y.z>"
   git push origin v<x.y.z>
   gh release create v<x.y.z> --verify-tag --notes "<the CHANGELOG entry>"
   ```

Until 1.0, a breaking change raises the minor version.

**A published tag never moves.** A ruleset refuses deleting or updating `v*`
tags. A lockfile records the commit a tag pointed at, so a moved tag would give
new installs different code from existing ones under the same version.

## Commits and pull requests

- Explain **why** in the commit body, not just what.
- Add a `CHANGELOG.md` entry for anything a user of the package would notice.
- Reference issues with a closing keyword **per issue**: `Closes #1, #2` only
  closes #1.
