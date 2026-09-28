// Property-based tests: generated patterns and subjects, checked against
// invariants rather than hand-picked examples. The seed is fixed so CI is
// deterministic; FC_SEED=<n> explores other inputs, and FC_RUNS=<n> changes how
// many (a failure prints the seed and path that reproduce it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { initSync, Regex, type Match } from '../src/index.ts';

initSync(readFileSync(new URL('../pcre2.wasm', import.meta.url)));

const seed = Number(process.env['FC_SEED'] ?? 20260928);
const numRuns = Number(process.env['FC_RUNS'] ?? 400);
const check = (property: fc.IRawProperty<unknown>) => fc.assert(property, { seed, numRuns });

// ---------------------------------------------------------------------------
// Subjects: a small alphabet, so generated patterns hit often. It has ASCII
// letters in both cases, a digit, `_` and `-`, a space, a newline, a
// two-unit character, an accented pair and a character above the surrogate
// range (U+FF01). It leaves out everything the two engines are documented to
// treat differently: `\r` and U+2028/9 (`.` and multiline `^`), non-ASCII
// spaces (`\s`), and U+017F and U+212A (`\w` under JS's `iu`).
// ---------------------------------------------------------------------------

const ALPHABET = ['a', 'b', 'c', 'A', '1', '_', '-', ' ', '\n', 'é', 'É', '😀', '\uff01'];
const subject = fc.array(fc.constantFrom(...ALPHABET), { maxLength: 12 }).map((cs) => cs.join(''));

/** A character as a pattern atom, escaped for use outside and inside a class. */
function literal(c: string, inClass = false): string {
  if (c === '\n') return '\\n';
  if (c === '-' && inClass) return '\\-';
  return c;
}

// ---------------------------------------------------------------------------
// Patterns: a grammar of the constructs on which PCRE2 and JavaScript's
// RegExp (with the `u` flag) are specified to agree. Left out, because they
// differ by design: `$` (PCRE also matches before a final newline),
// lookbehind (PCRE requires a bounded length), backreferences, multiline
// mode (PCRE's `^` does not match after a newline that ends the subject), and
// any quantifier over something that can match empty (the two engines stop an
// empty iteration at different points). Captures inside a quantifier are
// generated, but JS resets them on each iteration and PCRE keeps the last
// one, so those patterns compare the match and not the groups.
// ---------------------------------------------------------------------------

interface Node {
  src: string;
  /** Can match the empty string. */
  nullable: boolean;
  /** Is (or contains) a capturing group. */
  captures: boolean;
  /** Has a capturing group inside a quantifier. */
  captureInQuantifier: boolean;
  /** A single atom a quantifier can follow without a group around it. */
  atom: boolean;
}

const leaf = (src: string, nullable = false): Node => ({
  src,
  nullable,
  captures: false,
  captureInQuantifier: false,
  atom: !nullable,
});

const charClass = fc
  .tuple(fc.boolean(), fc.uniqueArray(fc.constantFrom(...ALPHABET), { minLength: 1, maxLength: 4 }))
  .map(([negated, cs]) => leaf(`[${negated ? '^' : ''}${cs.map((c) => literal(c, true)).join('')}]`));

const leaves = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(...ALPHABET).map((c) => leaf(literal(c))) },
  { weight: 2, arbitrary: charClass },
  { weight: 2, arbitrary: fc.constantFrom('.', '\\d', '\\w', '\\D', '\\W').map((s) => leaf(s)) },
  { weight: 1, arbitrary: fc.constantFrom('^', '\\b', '\\B').map((s) => leaf(s, true)) },
);

const QUANTIFIERS = ['*', '+', '?', '{0,2}', '{1,3}', '{2}'];

const { pattern } = fc.letrec<{ pattern: Node; group: Node; quantified: Node; alternation: Node; sequence: Node }>(
  (tie) => ({
    pattern: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      leaves,
      tie('group'),
      tie('quantified'),
      tie('alternation'),
      tie('sequence'),
    ),
    group: fc
      .tuple(fc.constantFrom('(', '(?:', '(?=', '(?!'), tie('pattern'))
      .map(([open, inner]): Node => {
        const assertion = open === '(?=' || open === '(?!';
        return {
          src: `${open}${inner.src})`,
          nullable: assertion || inner.nullable,
          captures: open === '(' || inner.captures,
          captureInQuantifier: inner.captureInQuantifier,
          // An assertion can match empty, so it is never quantified.
          atom: !assertion && !inner.nullable,
        };
      }),
    quantified: fc
      .tuple(tie('pattern'), fc.constantFrom(...QUANTIFIERS), fc.boolean())
      .filter(([inner]) => !inner.nullable)
      .map(([inner, q, lazy]): Node => {
        const body = inner.atom ? inner.src : `(?:${inner.src})`;
        return {
          src: `${body}${q}${lazy ? '?' : ''}`,
          nullable: q === '*' || q === '?' || q === '{0,2}',
          captures: inner.captures,
          captureInQuantifier: inner.captures,
          atom: false,
        };
      }),
    alternation: fc.tuple(tie('pattern'), tie('pattern')).map(
      ([a, b]): Node => ({
        src: `(?:${a.src}|${b.src})`,
        nullable: a.nullable || b.nullable,
        captures: a.captures || b.captures,
        captureInQuantifier: a.captureInQuantifier || b.captureInQuantifier,
        atom: !(a.nullable || b.nullable),
      }),
    ),
    sequence: fc.array(tie('pattern'), { minLength: 2, maxLength: 3 }).map(
      (parts): Node => ({
        // An alternation is always grouped, so parts concatenate as they are.
        src: parts.map((p) => p.src).join(''),
        nullable: parts.every((p) => p.nullable),
        captures: parts.some((p) => p.captures),
        captureInQuantifier: parts.some((p) => p.captureInQuantifier),
        atom: false,
      }),
    ),
  }),
);

const flags = fc.constantFrom('', 'i', 's', 'is');

/** Offsets that start a code point: 0, the end, and every boundary between. */
function boundaries(s: string): number[] {
  const out = [0];
  for (const c of s) out.push(out.at(-1)! + c.length);
  return out;
}

function splitsPair(s: string, offset: number): boolean {
  return offset > 0 && offset < s.length && /[\ud800-\udbff]/.test(s[offset - 1]!) && /[\udc00-\udfff]/.test(s[offset]!);
}

/** The first match from `start`, in the shape both engines can be compared in. */
function viaPcre(re: Regex, s: string, start: number, withGroups: boolean) {
  const m = re.exec(s, start);
  return m && { index: m.index, text: m[0], groups: withGroups ? [...m] : null };
}

function viaJs(src: string, flagLetters: string, s: string, start: number, withGroups: boolean) {
  const re = new RegExp(src, `${flagLetters}gu`);
  re.lastIndex = start;
  const m = re.exec(s);
  return m && { index: m.index, text: m[0], groups: withGroups ? [...m] : null };
}

test('generated patterns match what JavaScript matches, where the two agree by design', () => {
  check(
    fc.property(pattern, flags, subject, fc.nat(), (p, f, s, pick) => {
      const starts = boundaries(s);
      const start = starts[pick % starts.length]!;
      const withGroups = !p.captureInQuantifier;
      const js = viaJs(p.src, f, s, start, withGroups);
      // V8 can report an empty match inside a surrogate pair, which the spec
      // rules out for a `u` regex: /(?!.)/u.exec('😀').index is 1 in V8 13.6
      // (Node 24), where the spec's AdvanceStringIndex steps to 2. PCRE2 gives
      // 2. Such cases say nothing about this library, so they are set aside.
      fc.pre(!(js && splitsPair(s, js.index)));
      const re = new Regex(p.src, f);
      try {
        assert.deepEqual(viaPcre(re, s, start, withGroups), js);
      } finally {
        re.free();
      }
    }),
  );
});

// ---------------------------------------------------------------------------
// Invariants of every match, over a wider grammar: the one above plus the
// PCRE-only constructs it had to leave out.
// ---------------------------------------------------------------------------

const pcrePattern = fc.oneof(
  { weight: 3, arbitrary: pattern.map((p) => p.src) },
  {
    weight: 1,
    arbitrary: fc
      .tuple(pattern, fc.constantFrom('$', '\\z', '\\Z', '\\A', '\\K', '(?<=a)', '(?<!b)', '++', '*+', '?+'))
      .map(([p, extra]) => {
        if (extra.endsWith('+') && extra.length === 2) {
          return p.nullable ? p.src : `(?:${p.src})${extra}`;
        }
        return extra === '\\A' || extra.startsWith('(?<') ? `${extra}${p.src}` : `${p.src}${extra}`;
      }),
  },
  { weight: 1, arbitrary: pattern.map((p) => `(?>${p.src})`) },
);

// Not `x`: it drops the whitespace a generated pattern may need, which can
// leave a quantifier with nothing to repeat.
const pcreFlags = fc.constantFrom('', 'i', 'm', 's', 'U', 'imsu');

function assertWellFormed(m: Match, s: string) {
  assert.ok(m.index >= 0 && m.end <= s.length, 'match within the subject');
  assert.equal(m.input, s);
  if (m.index <= m.end) assert.equal(m[0], s.slice(m.index, m.end));
  for (let g = 0; g < m.length; g++) {
    const span = m.indices[g];
    assert.equal(m[g] === undefined, span === undefined, `group ${g} text and span agree on being set`);
    if (span) {
      const [start, end] = span;
      assert.ok(start >= 0 && end <= s.length);
      assert.equal(m[g], start <= end ? s.slice(start, end) : '');
      assert.ok(!splitsPair(s, start) && !splitsPair(s, end), `group ${g} does not split a surrogate pair`);
    }
  }
}

test('every match is well formed: text is the span, and spans never split a character', () => {
  check(
    fc.property(pcrePattern, pcreFlags, subject, (src, f, s) => {
      const re = new Regex(src, f);
      try {
        const all = [...re.matchAll(s)];
        for (const m of all) assertWellFormed(m, s);
        // matchAll starts where exec does.
        const first = re.exec(s);
        assert.equal(first === null, all.length === 0);
        if (first) assert.deepEqual([...first], [...all[0]!]);
        // It moves forward, and ends: at most an empty and a non-empty match
        // per position.
        for (let i = 1; i < all.length; i++) assert.ok(all[i]!.end >= all[i - 1]!.end);
        assert.ok(all.length <= 2 * (s.length + 1));
      } finally {
        re.free();
      }
    }),
  );
});

test('substitute() and replace() replace the same matches', () => {
  check(
    fc.property(pcrePattern, pcreFlags, subject, fc.constantFrom('', 'X', 'é😀'), fc.boolean(), (src, f, s, r, global) => {
      const re = new Regex(src, f);
      try {
        assert.equal(
          re.substitute(s, r, { global }),
          re.replace(s, () => r, global),
        );
      } finally {
        re.free();
      }
    }),
  );
});

test('exec() from any offset finds the first match at or after it', () => {
  check(
    fc.property(pcrePattern, subject, fc.nat(), (src, s, pick) => {
      const start = pick % (s.length + 1);
      const re = new Regex(src);
      try {
        const m = re.exec(s, start);
        const later = [...re.matchAll(s, start)][0] ?? null;
        assert.deepEqual(m && [...m], later && [...later]);
        // Never before the start, and never inside a character: a start
        // inside a surrogate pair moves past it.
        if (m) assert.ok(m.index >= start && !splitsPair(s, m.index));
      } finally {
        re.free();
      }
    }),
  );
});

test('a subject loaded for an earlier call never leaks into a later one', () => {
  // The module keeps the last subject in wasm memory and reuses it when the
  // next call passes the same string. A different string, longer or shorter,
  // must be matched as itself.
  check(
    fc.property(pattern, subject, subject, (p, s1, s2) => {
      const re = new Regex(p.src);
      try {
        const alone = (() => {
          re.exec('');
          return re.exec(s2);
        })();
        re.exec(s1 + s2 + s1);
        const after = re.exec(s2);
        assert.deepEqual(after && [...after], alone && [...alone]);
      } finally {
        re.free();
      }
    }),
  );
});

test('a lone surrogate is one character, matched as U+FFFD', () => {
  const withLone = fc
    // Both ends of both surrogate ranges, their neighbours either side, and a
    // real U+FFFD.
    .array(fc.constantFrom(...ALPHABET, '\ud7ff', '\ud800', '\udbff', '\udc00', '\udfff', '\ue000', '\ufffd'), {
      maxLength: 12,
    })
    .map((cs) => cs.join(''));
  check(
    fc.property(withLone, (s) => {
      const dot = new Regex('.', 's');
      const fffd = new Regex('\\x{FFFD}');
      try {
        // `.` takes one code point at a time, as JS's string iterator does.
        assert.deepEqual([...dot.matchAll(s)].map((m) => m[0]), [...s]);
        // Every lone surrogate, and every real U+FFFD, matches U+FFFD.
        const expected = [...s].filter((c) => c === '�' || (c.length === 1 && /[\ud800-\udfff]/.test(c))).length;
        assert.equal([...fffd.matchAll(s)].length, expected);
      } finally {
        dot.free();
        fffd.free();
      }
    }),
  );
});
