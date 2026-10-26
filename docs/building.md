# Building the module

`pcre2.wasm` is in the repository, so you do not need a build to use the
package. This file tells you how the module is built, how CI proves that the
committed file comes from the source, and how to upgrade PCRE2.

## The build

[`build/build.sh`](../build/build.sh) makes the module.

1. It downloads the pinned PCRE2 release (`PCRE2_VERSION`).
2. It compares the SHA-256 of the tarball with `PCRE2_SHA256`, and stops if
   they are different.
3. It compiles the 16-bit library with plain clang and links it with
   `wasm-ld`.

The build uses no emscripten and no wasi-sdk, and it makes no JS glue. The
module imports nothing. It has its own small libc in `build/libc/`, and
`build/bridge.c` is the interface that `src/index.ts` calls.

The build is byte-identical for one clang major version. `build.sh` names
that version in `EXPECTED_CLANG_MAJOR`, and gives a warning for a different
one. Another major version makes a module that works, but its bytes are
different.

## Commands

You need clang 18 with the wasm32 target, and `wasm-ld`. On Debian or
Ubuntu, install `clang-18` and `lld-18`.

```bash
npm run build:wasm   # rebuild pcre2.wasm and pcre2.wasm.sha256
npm run check:wasm   # rebuild in a temporary directory, and fail if the result is different
```

If `clang` and `wasm-ld` on your `PATH` are not version 18, set `CLANG` and
`WASM_LD`, as CI does:

```bash
CLANG=clang-18 WASM_LD=wasm-ld-18 build/build.sh --check
```

## What CI checks

The `wasm` job in `ci.yml` runs `build/build.sh --check` with clang 18. It
fails if the rebuilt module is not byte-identical to the committed
`pcre2.wasm`, or if the SHA-256 is not the one in `pcre2.wasm.sha256`. The
same build compiles the C of this repository with
`-Wall -Wextra -Werror`. The warning flags do not change the code that the
compiler makes.

The job also runs each week, because the PCRE2 download and the clang
package of the runner can change with no commit here.

## Change the module

1. Edit `build/build.sh` or the C in `build/`.
2. Run `npm run build:wasm`.
3. Commit `pcre2.wasm` and `pcre2.wasm.sha256` together, in the same commit
   as the source change.

## Upgrade PCRE2

1. Set `PCRE2_VERSION` and `PCRE2_SHA256` in `build/build.sh` to the new
   release.
2. Compare the `LICENCE.md` of the release with `LICENCE-PCRE2.md`. If they
   are different, update `LICENCE-PCRE2.md` and `NOTICE`.
3. Change the version that the version test in `src/regex.test.ts` expects.
4. Run `npm run build:wasm`, then the gates in
   [CONTRIBUTING](../CONTRIBUTING.md#pull-requests).
5. Add a `CHANGELOG.md` entry. A PCRE2 upgrade changes what each consumer
   gets.

Dependabot does not see the PCRE2 version. Look for a new release on the
[PCRE2 releases page](https://github.com/PCRE2Project/pcre2/releases).
