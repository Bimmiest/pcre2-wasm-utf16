# The API

This file tells you how to load the module, how to use `Regex`, and how the
package uses memory. The types and the JSDoc in [`src/index.ts`](../src/index.ts)
are the reference for each signature.

## Loading

The package does not fetch or read a file. Give `init` the bytes, or a
`WebAssembly.Module` that you compiled before.

```ts
import { init, initSync, getModule, Regex } from 'pcre2-wasm-utf16';

// Browser: compile one time, with streaming. A CSP script-src needs 'wasm-unsafe-eval'.
const wasmUrl = new URL('pcre2-wasm-utf16/pcre2.wasm', import.meta.url);
await init(WebAssembly.compileStreaming(fetch(wasmUrl)));

// Send the compiled module to a worker. Then the worker does not compile it again.
worker.postMessage({ pcre2: getModule() });
// In the worker. Synchronous instantiation is acceptable off the main thread.
initSync(event.data.pcre2);

// Node:
import { readFileSync } from 'node:fs';
initSync(readFileSync(new URL('../pcre2.wasm', import.meta.url)));
```

Before `init` or `initSync` completes, each entry point throws an error that
tells you to call `init()`. `isReady()` tells you if the module is loaded.

## Memory limit

Each instance has its own wasm memory. Compiled patterns, subjects and match
state use it. By default the memory can grow to 1 GiB (`MAX_MEMORY_BYTES`).
To set a lower limit, give `maxMemoryBytes` to `init` or `initSync`:

```ts
// A worker that runs patterns from a user: 256 MiB at most.
initSync(event.data.pcre2, { maxMemoryBytes: 256 * 1024 * 1024 });
```

The limit is from 2 MiB to 1 GiB, in 64 KiB pages. When an allocation goes
past it, the call throws `RegexMatchError` with code -48
(`PCRE2_ERROR_NOMEMORY`). The instance continues to work.

## Use

```ts
const re = new Regex('(?<key>\\w+)=(?<value>\\S+)', 'i', { matchLimit: 100000 });

re.exec('a=1 b=2'); // the first match, or null
re.exec('a=1 b=2', 4); // the first match at or after offset 4
re.test('a=1'); // boolean
for (const m of re.matchAll('a=1 b=2')) {
  m[0]; // 'a=1'
  m.index, m.end; // 0, 3
  m.groups?.key; // 'a'
  m.indices[2]; // [2, 3]
}
re.substitute('a=1 b=2', '${value}=${key}', { global: true }); // '1=a 2=b'
re.replace('a=1 b=2', (m) => m[1]!.toUpperCase(), true); // 'A B'

re.free(); // release the wasm memory of the compiled pattern
```

A match has the shape of a `RegExpExecArray` with the `d` flag. Element N is
the text of group N, or `undefined` when the group did not match.

## Flags

A flag is one letter.

| Flag | PCRE2 option |
|---|---|
| `i` | Caseless |
| `m` | Multiline |
| `s` | Dotall |
| `x` | Extended |
| `n` | No auto-capture |
| `U` | Ungreedy |
| `J` | Duplicate names |
| `u` | UCP: Unicode `\w`, `\d`, `\b` and POSIX classes |
| `A` | Anchored |
| `D` | Dollar end only |

Inline settings, for example `(?i)`, `(*UCP)` and `(*CRLF)`, work as in
PCRE2. An unknown flag letter throws.

## Semantics

- **Offsets** are UTF-16 indices. The 16-bit library gets the code units of
  the JS string with no change. Thus each offset that PCRE2 gives is an index
  into the JS string. Nothing is transcoded to UTF-8.
- **Iteration** follows the rule of PCRE2 (`pcre2_next_match`). After an
  empty match, the next attempt starts at the same position, and an empty
  match there is not permitted, as in Perl. JS `matchAll` moves forward one
  code unit instead.
- **Newlines** are LF, the default of PCRE2. `.` matches `\r`. `$` matches at
  the end, or before a final `\n`.
- **Lone surrogates** in a subject match as U+FFFD. Each one is one code unit,
  so the offsets do not change. The text in a match comes from the original
  string.
- **No JIT.** WebAssembly has no JIT for PCRE2, so each match runs the
  interpreter (`pcre2_match`). The match limit and the depth limit count
  what the interpreter counts. Under JIT, they count different things.

## Errors and limits

- A pattern that PCRE2 does not accept throws `RegexSyntaxError`. Its
  `offset` is the position in the pattern.
- A match that gets to a limit throws `RegexMatchError`, with the PCRE2 error
  `code`: `ERROR_MATCHLIMIT`, `ERROR_DEPTHLIMIT` or `ERROR_HEAPLIMIT`.
- `matchLimit` and `depthLimit` are options of the constructor. A limit of 0
  becomes 1. A limit that is not finite becomes the PCRE2 default.
- The backtrack memory of one match has a maximum of 64 MiB.

## Memory

Compiled patterns are in wasm memory, and the garbage collector does not see
that memory.

- Call `free()` when you do not need a `Regex` again. If the collector
  removes a `Regex` before you call `free()`, a `FinalizationRegistry` frees
  it later. A `Regex` that is freed throws when you use it.
- All calls share one subject buffer and one match-data block. Each grows to
  the largest size that a call used.
- Wasm memory can grow to 1 GiB, and it does not get smaller.
- A `Regex` from an earlier `init` throws. It does not run against the new
  instance.
