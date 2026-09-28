// Wasm memory is invisible to the garbage collector, so a missed free is a
// leak nothing else reports. This file wraps WebAssembly.Instance before the
// library loads, to watch the module's memory, then checks that repeating
// each operation many times leaves it the size it was. (node:test runs each
// file in its own process, so the wrapper reaches no other test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

type Instance = { exports: { memory?: { buffer: ArrayBuffer } } };
type InstanceConstructor = new (module: object, imports: object) => Instance;

const wasm = (globalThis as unknown as { WebAssembly: { Instance: InstanceConstructor } }).WebAssembly;
const Original = wasm.Instance;
let memory: { buffer: ArrayBuffer } | undefined;
wasm.Instance = function (module: object, imports: object) {
  const instance = new Original(module, imports);
  memory = instance.exports.memory;
  return instance;
} as unknown as InstanceConstructor;

const { initSync, Regex, RegexSyntaxError, version } = await import('../src/index.ts');
initSync(readFileSync(new URL('../pcre2.wasm', import.meta.url)));

const size = () => memory!.buffer.byteLength;

/** Grows memory to its working size, then checks that many more rounds leave it there. */
function assertNoGrowth(label: string, operation: (i: number) => void) {
  for (let i = 0; i < 200; i++) operation(i);
  const before = size();
  // Enough rounds that a leak of even a few bytes each would outgrow the
  // spare room and add a 64 KiB page.
  for (let i = 0; i < 20_000; i++) operation(i);
  assert.equal(size(), before, `${label}: memory grew from ${before} to ${size()} bytes`);
}

test('compiling and freeing a pattern leaks nothing', () => {
  assertNoGrowth('compile and free', (i) => new Regex(`(?<g${i % 7}>a|b)+c`).free());
});

test('a pattern PCRE2 rejects leaks nothing', () => {
  assertNoGrowth('rejected pattern', () => {
    assert.throws(() => new Regex('ab(c'), RegexSyntaxError);
  });
});

test('matching, iterating and replacing leak nothing', () => {
  const re = new Regex('(\\w)(\\d)?');
  assertNoGrowth('match', (i) => {
    // A different subject each time, so each call copies one in.
    const subject = `x${i} y${i}`;
    re.exec(subject);
    for (const _ of re.matchAll(subject)) void _;
    re.substitute(subject, '[$1]', { global: true });
    re.replace(subject, (m) => m[0].toUpperCase(), true);
  });
});

test('failed replacements and version() leak nothing', () => {
  const re = new Regex('(a)');
  assertNoGrowth('errors and version', () => {
    assert.throws(() => re.substitute('a', '${nope}'), RegexSyntaxError);
    version();
  });
});

test('a subject that outgrows its buffer frees the old one', () => {
  const re = new Regex('z');
  re.exec('x'.repeat(2000));
  const before = size();
  // Each subject is one code unit longer than the last, so each needs a new
  // buffer: 3,000 of them, 4 to 10 KB each, would add 20 MB if none were freed.
  for (let n = 2001; n < 5000; n++) re.exec('x'.repeat(n));
  const grown = size() - before;
  assert.ok(grown < 1 << 20, `memory grew by ${grown} bytes`);
});

test('a Regex collected without free() is released, once', async () => {
  // The garbage collector, on demand.
  setFlagsFromString('--expose-gc');
  const gc = runInNewContext('gc') as () => void;
  const collect = async () => {
    for (let i = 0; i < 5; i++) {
      gc();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };
  const abandon = (n: number) => {
    for (let i = 0; i < n; i++) new Regex(`(?<g>a|b)+c${i % 7}`);
  };
  abandon(20_000);
  await collect();
  const before = size();
  abandon(20_000);
  await collect();
  // The finalizer freed the first batch, so the second reused its memory.
  assert.equal(size(), before);
  // A pattern freed by hand and then collected is not freed a second time,
  // which would hand one block to two later patterns.
  for (let i = 0; i < 1000; i++) new Regex(`x${i}`).free();
  await collect();
  const a = new Regex('a+');
  const b = new Regex('b+');
  assert.equal(a.exec('xaab')?.[0], 'aa');
  assert.equal(b.exec('xaab')?.[0], 'b');
});
