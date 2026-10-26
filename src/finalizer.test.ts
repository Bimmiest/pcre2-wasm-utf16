// The finalizer across a second init. A Regex compiled before that init holds
// an address in the old instance. When the collector removes it later, the
// finalizer must not free that address in the new instance, where it can
// belong to a live pattern. A file of its own, because the second init
// changes the instance for each later case in the file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { getModule, initSync, Regex } from './index.ts';
import { collect } from './test/gc.ts';

initSync(readFileSync(new URL('../pcre2.wasm', import.meta.url)));

test('a Regex from an earlier init, collected later, frees nothing in the new instance', async () => {
  const patterns = Array.from({ length: 1000 }, (_, i) => `(?<g>a|b)+c${i}`);
  // Compiled in the first instance, and unreachable when the function returns.
  (() => {
    for (const p of patterns) new Regex(p);
  })();
  initSync(getModule());
  // The same patterns in the same order, in a new instance, so each one gets
  // the address that its abandoned twin had.
  const live = patterns.map((p) => new Regex(p));
  await collect();
  // If the finalizer freed those addresses, these take the blocks of the
  // live patterns, and the live patterns run them.
  const later = patterns.map((p) => new Regex(p.replace('c', 'd')));
  live.forEach((re, i) => {
    assert.equal(re.exec(`abc${i}`)?.[0], `abc${i}`);
  });
  later.forEach((re, i) => {
    assert.equal(re.exec(`abd${i}`)?.[0], `abd${i}`);
  });
});
