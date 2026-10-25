// Vitest runs each file in its own module graph, so nothing here has called
// init(): these are the module's answers before it has a WebAssembly instance.
// One case, not two: the order is the subject, and the weekly randomised run
// shuffles the cases of a file.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { getModule, init, isReady, Regex, version } from './index.ts';

test('before init, nothing runs and each entry point says why; init() from bytes is then enough', async () => {
  assert.equal(isReady(), false);
  const why = /not initialised: call init\(\) first/;
  assert.throws(() => getModule(), why);
  assert.throws(() => version(), why);
  assert.throws(() => new Regex('a'), why);

  await init(readFileSync(new URL('../pcre2.wasm', import.meta.url)));
  assert.ok(isReady());
  assert.ok(new Regex('a').test('a'));
});
