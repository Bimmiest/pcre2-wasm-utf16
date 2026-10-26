// The host's limit on the module's memory (#12). The module imports its
// memory, so the loader creates it with the maximum the host asks for.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { init, initSync, MAX_MEMORY_BYTES, Regex, RegexMatchError } from './index.ts';

const bytes = readFileSync(new URL('../pcre2.wasm', import.meta.url));
const MiB = 1024 * 1024;

test('refuses a limit outside 2 MiB to the module maximum', async () => {
  for (const maxMemoryBytes of [0, 2 * MiB - 1, MAX_MEMORY_BYTES + 1, Number.NaN]) {
    assert.throws(() => initSync(bytes, { maxMemoryBytes }), RangeError);
    await assert.rejects(init(bytes, { maxMemoryBytes }), RangeError);
  }
});

test('an allocation past the limit fails as a no-memory RegexMatchError, and the instance keeps working', () => {
  initSync(bytes, { maxMemoryBytes: 4 * MiB });
  const re = new Regex('a+');
  // 3 Mi code units are 6 MiB in UTF-16: more than the limit.
  assert.throws(
    () => re.exec('a'.repeat(3 * MiB)),
    (error: unknown) => error instanceof RegexMatchError && error.code === -48,
  );
  assert.equal(re.exec('xaay')?.index, 1);
  re.free();
});

test('without a limit the module may grow to its maximum, so the same subject fits', () => {
  initSync(bytes);
  const re = new Regex('a+');
  assert.equal(re.exec('a'.repeat(3 * MiB))?.index, 0);
  re.free();
});
