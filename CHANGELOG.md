# Changelog

All notable changes to pcre2-wasm-utf16 are documented here, newest first.

---

## Unreleased

---

## 0.1.0 — 2026-09-28

The first release as a standalone repository. The package was developed in
[propslab](https://github.com/Bimmiest/propslab) as `packages/pcre2-wasm`
([propslab#380](https://github.com/Bimmiest/propslab/pull/380)) and moved here
unchanged, so that propslab and other consumers can install it by name.

- **PCRE2 10.48**, the 16-bit library in UTF mode, so every offset is a JS
  string index. Built reproducibly from the pinned release with clang 18 and
  `wasm-ld`, with no emscripten and no JS glue; CI rebuilds the module and
  checks it is byte-identical to the committed one.
- **`Regex`** with `exec`, `test`, `matchAll` (advancing as `pcre2_next_match`
  does), `substitute` (PCRE2's replacement syntax), `replace` (a callback per
  match) and `free`. Matches are shaped like a `RegExpExecArray` with the `d`
  flag.
- **Match, depth and heap limits**, surfaced as `RegexMatchError` with PCRE2's
  error code; a rejected pattern throws `RegexSyntaxError` with its offset.
- **Installing** is from a tag:
  `npm install github:Bimmiest/pcre2-wasm-utf16#v0.1.0`.
