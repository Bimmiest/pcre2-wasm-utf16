# Security policy

## How to report a vulnerability

Report it privately through the
[private vulnerability reporting](https://github.com/Bimmiest/pcre2-wasm-utf16/security/advisories/new)
of GitHub: open the **Security** tab, then select **Report a vulnerability**.
Do not open a public issue for a security problem.

You get an acknowledgement within a week. If the report is valid, the fix
and the advisory are published together.

## What this package is

This package is PCRE2, compiled to WebAssembly, with a TypeScript wrapper.
Consumers use it to run regular expressions that they did not write, on text
that they did not write. For example,
[propslab](https://github.com/Bimmiest/propslab) runs patterns from its users
in the browser and in a local MCP server.

The module imports nothing. It has no access to files, the network or a
clock. Nothing that it does can get out of its linear memory, which has a
maximum of 1 GiB. The wrapper copies strings into that memory and out of it,
and does not give the memory to other code.

## In scope

- **Results that are wrong because of this package.** Examples: offsets
  that do not agree with the subject, state from one pattern or call that
  goes into another, a lone surrogate that moves offsets, and a freed
  `Regex`, or a `Regex` from an earlier `init`, that runs.
- **Limits that do not hold.** Examples: a match that does not stop at the
  match, depth and heap limits, and memory that grows past the maximum with
  no `RegexMatchError`.
- **Memory safety in the C of this repository:** `build/bridge.c`, and the
  freestanding libc and allocator in `build/libc/`.
- **The build.** Examples: a committed `pcre2.wasm` that is different from
  what `build/build.sh` makes from the pinned PCRE2 release, with no CI
  failure, or a build that uses a source other than that release.
- **Secrets in the repository or its history.** CI scans the full history on
  each pull request and each week. A secret that CI finds is rotated, not
  allowlisted.

## Out of scope

- **Vulnerabilities in PCRE2.** Report them to the PCRE2 project, as its
  [security policy](https://github.com/PCRE2Project/pcre2/security/policy)
  says. Also tell us, so that we can ship the fixed release.
- **Slow patterns that a limit stops.** A pattern that backtracks until a
  limit stops it shows that the limits work. Consumers set the limits.
- **Advisories in development dependencies.** The package has no runtime
  dependencies, so no development dependency ships.

## Supported versions

Fixes go to `main` and to a new release tag. There is no support branch for
older releases.
