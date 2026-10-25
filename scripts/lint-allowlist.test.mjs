// Holds scripts/lint-allowlist.json to what each rule finds today. The config
// turns the listed rules off for the listed files, so `npm run lint` cannot
// see a new finding there; this test lints those files with the rules on and
// compares the counts in both directions.
import { readFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url).pathname;
const { files } = JSON.parse(readFileSync(new URL('lint-allowlist.json', import.meta.url), 'utf8'));

describe('the lint allowlist', () => {
  for (const [file, rules] of Object.entries(files)) {
    it(`${file} has exactly the listed findings`, async () => {
      const eslint = new ESLint({
        cwd: root,
        overrideConfig: [{ files: [file], rules: Object.fromEntries(Object.keys(rules).map((r) => [r, 'error'])) }],
      });
      const [result] = await eslint.lintFiles([file]);
      const found = Object.fromEntries(Object.keys(rules).map((r) => [r, 0]));
      for (const { ruleId } of result.messages) if (ruleId in found) found[ruleId] += 1;
      expect(found, 'Lower the count in scripts/lint-allowlist.json, or fix the new finding').toEqual(rules);
    }, 60_000);
  }
});
