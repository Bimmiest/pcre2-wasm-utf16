// node:test runs each file in its own process, so nothing here has called
// init(): these are the module's answers before it has a WebAssembly instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getModule, init, isReady, Regex, version } from '../src/index.ts';

test('before init, nothing runs and each entry point says why', () => {
  assert.equal(isReady(), false);
  const why = /not initialised: call init\(\) first/;
  assert.throws(() => getModule(), why);
  assert.throws(() => version(), why);
  assert.throws(() => new Regex('a'), why);
});

test('init() from bytes is enough on its own', async () => {
  await init(readFileSync(new URL('../pcre2.wasm', import.meta.url)));
  assert.ok(isReady());
  assert.ok(new Regex('a').test('a'));
});
