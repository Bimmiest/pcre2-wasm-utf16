# Security Policy

## Reporting a vulnerability

Report privately through GitHub's [private vulnerability reporting](https://github.com/Bimmiest/pcre2-wasm-utf16/security/advisories/new): the **Security** tab, then **Report a vulnerability**. Please do not open a public issue for a security problem.

Expect an acknowledgement within a week. If a report is valid, the fix and the advisory go out together.

## What this package is

PCRE2 compiled to WebAssembly, with a TypeScript wrapper. Consumers use it to run regular expressions they did not write, on text they did not write: [propslab](https://github.com/Bimmiest/propslab), for one, runs user-written patterns in the browser and in a local MCP server.

The module imports nothing. It has no file, network or clock access, and nothing it does can reach outside its own linear memory, which is capped at 1 GiB. The wrapper copies strings in and out of that memory and never hands it to anything else.

## In scope

- **Results that are wrong because of this package**: offsets that do not match the subject, one pattern's or call's state leaking into another's, a lone surrogate shifting offsets, or a freed `Regex`, or one from an earlier `init`, running anyway.
- **Limits that do not hold**: a match that runs without bound despite the match, depth and heap limits, or memory that grows past the cap without a `RegexMatchError`.
- **Memory safety in this repository's C**: `build/bridge.c` and the freestanding libc and allocator in `build/libc/`.
- **The build**: a way for the committed `pcre2.wasm` to differ from what `build/build.sh` produces from the pinned PCRE2 release without CI noticing, or for the build to use anything but that release.

## Out of scope

- **Vulnerabilities in PCRE2 itself.** Report those to the PCRE2 project, following its [security policy](https://github.com/PCRE2Project/pcre2/security/policy). Please also tell us, so we can ship the fixed release.
- **Slow patterns stopped by the limits.** A pattern that backtracks until a limit stops it is the limits working. Consumers choose the limits.
- **Advisories in development dependencies.** None of them ship: the package has no runtime dependencies.
