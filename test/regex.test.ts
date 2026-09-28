import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  ERROR_DEPTHLIMIT,
  ERROR_HEAPLIMIT,
  ERROR_MATCHLIMIT,
  getModule,
  init,
  initSync,
  isReady,
  Regex,
  RegexMatchError,
  RegexSyntaxError,
  version,
} from '../src/index.ts';

const wasmPath = new URL('../pcre2.wasm', import.meta.url);
const bytes = readFileSync(wasmPath);
initSync(bytes);

const spans = (re: Regex, s: string) => [...re.matchAll(s)].map((m) => [m.index, m[0]]);

test('the committed module matches its recorded checksum', () => {
  const recorded = readFileSync(new URL('../pcre2.wasm.sha256', import.meta.url), 'utf8').split(/\s+/)[0];
  assert.equal(createHash('sha256').update(bytes).digest('hex'), recorded);
});

test('initialises from bytes, a compiled module, or a promise, and reports its version', async () => {
  assert.ok(isReady());
  assert.match(version(), /^10\.48 \d{4}-\d{2}-\d{2}$/);
  initSync(getModule());
  await init(Promise.resolve(bytes));
  await init(getModule());
  assert.ok(new Regex('a').test('a'));
});

test('offsets are UTF-16 indices, astral characters included', () => {
  const m = new Regex('(.)(x)').exec('é😀x')!;
  assert.equal(m.index, 1);
  assert.equal(m.end, 4);
  assert.equal(m[1], '😀');
  assert.deepEqual(m.indices[1], [1, 3]);
  assert.deepEqual(m.indices[2], [3, 4]);
});

test('named groups, unset groups and duplicate names', () => {
  const m = new Regex('(?<k>\\w+)=(?P<v>\\w+)(x)?').exec(' a=b')!;
  // Null-prototype, like a RegExp's, so a group named __proto__ is just a key.
  assert.equal(Object.getPrototypeOf(m.groups), null);
  assert.deepEqual({ ...m.groups }, { k: 'a', v: 'b' });
  assert.equal(new Regex('(?<__proto__>x)').exec('x')!.groups?.['__proto__'], 'x');
  assert.equal(m[3], undefined);
  assert.equal(m.indices[3], undefined);
  assert.deepEqual(m.indices.groups?.v, [3, 4]);

  const dup = new Regex('(?:(?<n>a)|(?<n>b))', 'J');
  assert.deepEqual(dup.names, ['n']);
  assert.deepEqual(dup.groupNames, [undefined, 'n', 'n']);
  assert.equal(dup.exec('b')!.groups?.n, 'b');
  // The first group of a name that took part wins, not the last.
  assert.equal(dup.exec('a')!.groups?.n, 'a');
  assert.equal(new Regex('x').exec('x')!.groups, undefined);
});

test('a match has the own properties a RegExp match has', () => {
  const m = new Regex('(?<a>x)|(?<b>y)|(z)').exec('y')!;
  // Groups that did not take part are present and undefined, not holes.
  assert.ok(Object.hasOwn(m, 1) && Object.hasOwn(m, 3));
  assert.ok(Object.hasOwn(m.indices, 1) && Object.hasOwn(m.indices, 3));
  assert.deepEqual(Object.keys(m.groups!), ['a', 'b']);
  assert.deepEqual(Object.keys(m.indices.groups!), ['a', 'b']);
  assert.deepEqual(new Regex('(x)(?<n>y)?').groupNames, [undefined, undefined, 'n']);
  // With no named groups, `groups` is still an own property.
  assert.ok(Object.hasOwn(new Regex('x').exec('x')!, 'groups'));
  assert.ok(Object.hasOwn(new Regex('x').exec('x')!.indices, 'groups'));
});

test('a start offset outside the subject finds nothing and changes nothing', () => {
  const re = new Regex('a');
  for (const start of [-1, 2]) {
    assert.equal(re.exec('a', start), null);
    assert.equal(re.test('a', start), false);
    assert.deepEqual([...re.matchAll('a', start)], []);
    assert.equal(re.substitute('a', 'x', { start }), 'a');
  }
  // The end itself is a valid start.
  assert.deepEqual(new Regex('$').exec('a', 1)?.index, 1);
});

test('a start offset inside a surrogate pair moves past the pair', () => {
  const dot = new Regex('.');
  assert.deepEqual(dot.exec('😀a', 1)?.index, 2);
  assert.deepEqual([...dot.matchAll('😀a', 1)].map((m) => m[0]), ['a']);
  assert.equal(dot.substitute('😀a', 'x', { start: 1 }), '😀x');
  // Not when the two halves are not a pair, either way round.
  assert.equal(new Regex('\\x{FFFD}').exec('a\udc00', 1)?.index, 1);
  assert.equal(dot.exec('\ud800a', 1)?.index, 1);
});

test('errors say what they are', () => {
  assert.throws(() => new Regex('('), { name: 'RegexSyntaxError' });
  assert.throws(() => new Regex('(a+)+$', '', { matchLimit: 1 }).test('aab'), { name: 'RegexMatchError' });
});

test('flags', () => {
  assert.ok(new Regex('abc', 'i').test('ABC'));
  assert.ok(new Regex('^b', 'm').test('a\nb'));
  assert.ok(new Regex('a.b', 's').test('a\nb'));
  assert.ok(new Regex('a b # comment', 'x').test('ab'));
  assert.equal(new Regex('(a)', 'n').captureCount, 0);
  assert.equal(new Regex('a+', 'U').exec('aaa')![0], 'a');
  assert.ok(!new Regex('\\w').test('é'));
  assert.ok(new Regex('\\w', 'u').test('é'));
  assert.equal(new Regex('b', 'A').exec('ab'), null);
  assert.ok(!new Regex('a$', 'D').test('a\n'));
  assert.throws(() => new Regex('a', 'g'), /Unknown flag/);
});

test('PCRE semantics JS regexes lack', () => {
  // `$` also matches before a final newline; `\z` does not, `\Z` does.
  assert.ok(new Regex('a$').test('a\n'));
  assert.ok(!new Regex('a\\z').test('a\n'));
  assert.ok(new Regex('a\\Z').test('a\n'));
  // With LF newlines, `.` matches `\r`.
  assert.ok(new Regex('a.b').test('a\rb'));
  assert.ok(!new Regex('a.b').test('a\nb'));
  // `\A` anchors to the subject start even in multiline mode.
  assert.ok(!new Regex('\\Ab', 'm').test('a\nb'));
  // Possessive quantifiers and atomic groups do not give back.
  assert.ok(!new Regex('a++a').test('aaa'));
  assert.ok(!new Regex('(?>a+)a').test('aaa'));
  // Recursion.
  assert.equal(new Regex('\\((?:[^()]|(?R))*\\)').exec('x(a(b)c)y')![0], '(a(b)c)');
  // \K resets the reported start.
  const k = new Regex('foo\\Kbar').exec('foobar')!;
  assert.equal(k[0], 'bar');
  assert.equal(k.index, 3);
  // Conditionals.
  const cond = new Regex('^(<)?\\w+(?(1)>)$');
  assert.ok(cond.test('<a>') && cond.test('a') && !cond.test('<a'));
  // Unicode properties.
  assert.ok(new Regex('^\\p{Lu}').test('Éa'));
});

test('global iteration follows pcre2_next_match', () => {
  assert.deepEqual(spans(new Regex('x*'), 'axxb'), [
    [0, ''],
    [1, 'xx'],
    [3, ''],
    [4, ''],
  ]);
  // After an empty match the same place is retried with non-empty required.
  assert.deepEqual(spans(new Regex('a??'), 'aa'), [
    [0, ''],
    [0, 'a'],
    [1, ''],
    [1, 'a'],
    [2, ''],
  ]);
  assert.deepEqual(spans(new Regex('\\d+'), 'a1b22', ), [
    [1, '1'],
    [3, '22'],
  ]);
  assert.deepEqual(spans(new Regex('\\d'), 'a1b2c3').length, 3);
  assert.deepEqual([...new Regex('\\d').matchAll('123', 1)].map((m) => m[0]), ['2', '3']);
  // An empty match never splits a surrogate pair.
  assert.deepEqual(spans(new Regex(''), '😀'), [
    [0, ''],
    [2, ''],
  ]);
});

test('interleaving patterns does not disturb an iteration in progress', () => {
  const outer = new Regex('\\w');
  const inner = new Regex('(\\d)');
  const seen: string[] = [];
  for (const m of outer.matchAll('a1b')) {
    inner.exec('xyz9');
    seen.push(m[0]);
  }
  assert.deepEqual(seen, ['a', '1', 'b']);
});

test('substitute', () => {
  // Without `extended`, a backslash in the replacement is literal.
  assert.equal(new Regex('a').substitute('a', '\\U\\n'), '\\U\\n');
  // Output longer than one read chunk (8192 code units) comes back whole.
  const long = new Regex('a').substitute('a'.repeat(10000), 'bc', { global: true });
  assert.equal(long, 'bc'.repeat(10000));
  const re = new Regex('(?<k>\\w+)=(\\w+)');
  assert.equal(re.substitute('a=1 b=2', '$2:${k}'), '1:a b=2');
  assert.equal(re.substitute('a=1 b=2', '$2:${k}', { global: true }), '1:a 2:b');
  assert.equal(re.substitute('a=1 b=2', '$$', { global: true, start: 4 }), 'a=1 $');
  assert.equal(re.substitute('a=1', '\\U$1', { extended: true }), 'A');
  assert.equal(new Regex('(x)?y').substitute('y', '[$1]'), '[]');
  // Output longer than the first buffer guess.
  assert.equal(new Regex('a').substitute('aaaa', 'x'.repeat(100), { global: true }).length, 400);
  assert.throws(() => re.substitute('a=1', '${nope}'), RegexSyntaxError);
});

test('a malformed replacement is a syntax error, with PCRE2\'s code', () => {
  const re = new Regex('(a)');
  for (const [replacement, extended, code] of [
    ['$', false, -35],
    ['${nope}', false, -49],
    ['$9', false, -49],
    ['\\q', true, -57],
    ['${1', false, -58],
    ['${1:x}', true, -59],
  ] as const) {
    assert.throws(
      () => re.substitute('a', replacement, { extended }),
      (e: unknown) => e instanceof RegexSyntaxError && e.code === code,
      `${replacement} (extended: ${extended})`,
    );
  }
});

test('an output too large for wasm memory throws rather than crashing', () => {
  // 300 million code units is 600 MB, and the allocator rounds that up to a
  // 1 GiB block: the module's whole memory ceiling. Repeating `$0` keeps this
  // cheap, since once the output overflows PCRE2 only adds up lengths.
  assert.throws(
    () => new Regex('(?s).+').substitute('a'.repeat(100_000), '$0'.repeat(3000)),
    (e: unknown) => e instanceof RegexMatchError && e.code === -48,
  );
  // The module still works afterwards.
  assert.equal(new Regex('a').substitute('a', 'b'), 'b');
});

test('replace with a callback', () => {
  const re = new Regex('\\d+');
  assert.equal(re.replace('a1b22', (m) => `<${m[0]}>`, true), 'a<1>b<22>');
  assert.equal(re.replace('a1b22', (m) => `<${m[0]}>`), 'a<1>b22');
  assert.equal(new Regex('x*').replace('ab', () => '-', true), '-a-b-');
});

test('a pattern PCRE2 rejects throws with the offset', () => {
  try {
    new Regex('ab(c');
    assert.fail('expected a throw');
  } catch (e) {
    assert.ok(e instanceof RegexSyntaxError);
    assert.equal(e.offset, 4);
    assert.match(e.message, /missing closing parenthesis/);
  }
});

test('match and depth limits stop a runaway match', () => {
  const subject = `${'a'.repeat(28)}b`;
  const limited = new Regex('(a+)+$', '', { matchLimit: 10000 });
  assert.throws(
    () => limited.test(subject),
    (e: unknown) => e instanceof RegexMatchError && e.code === ERROR_MATCHLIMIT,
  );
  const deep = new Regex('^(?:a|b)*$', '', { depthLimit: 10 });
  assert.throws(
    () => deep.test('ab'.repeat(50)),
    (e: unknown) => e instanceof RegexMatchError && e.code === ERROR_DEPTHLIMIT,
  );
  // The default limits still stop it, eventually.
  assert.throws(() => new Regex('(a+)+$').test(`${'a'.repeat(40)}b`), RegexMatchError);
  // The heap limit bounds backtracking memory whatever the other two allow.
  assert.throws(
    () => new Regex('(?:(?=(a))a)*c', '', { matchLimit: 1e9, depthLimit: 1e9 }).test('a'.repeat(2_000_000)),
    (e: unknown) => e instanceof RegexMatchError && e.code === ERROR_HEAPLIMIT,
  );
  // substitute() runs under the same limits, and a limit is not a syntax error.
  assert.throws(
    () => limited.substitute(subject, 'x'),
    (e: unknown) => e instanceof RegexMatchError && e.code === ERROR_MATCHLIMIT,
  );
});

test('a lone surrogate matches as U+FFFD without shifting offsets', () => {
  const m = new Regex('\\x{FFFD}(b)').exec('a\ud800b')!;
  assert.equal(m.index, 1);
  assert.equal(m[0], '\ud800b');
  assert.deepEqual(m.indices[1], [2, 3]);
});

test('limits: 0 means 1, a non-finite limit means the default', () => {
  const catastrophic = `${'a'.repeat(28)}b`;
  // A limit only bounds a match; one well inside it is unaffected.
  assert.ok(new Regex('abc', '', { matchLimit: 1000, depthLimit: 1000 }).test('xxabc'));
  assert.throws(() => new Regex('abc', '', { matchLimit: 0 }).test('xxabc'), RegexMatchError);
  for (const matchLimit of [Infinity, NaN]) {
    // Unlimited would run for minutes; the default stops it.
    assert.throws(
      () => new Regex('(a+)+$', '', { matchLimit }).test(catastrophic),
      (e: unknown) => e instanceof RegexMatchError && e.code === ERROR_MATCHLIMIT,
    );
  }
});

test('free releases the pattern; using it afterwards throws', () => {
  const re = new Regex('a');
  assert.equal(re.freed, false);
  re.free();
  re.free();
  assert.ok(re.freed);
  assert.throws(() => re.test('a'), /freed/);
});

test('a Regex from an earlier init is refused rather than run', () => {
  const before = new Regex('a');
  initSync(getModule());
  assert.throws(() => before.test('a'), /earlier init/);
});

test('freeing a Regex from an earlier init leaves the new instance alone', () => {
  initSync(getModule());
  const before = new Regex('x+');
  initSync(getModule());
  // Allocated in the new instance where `before` was in the old one, so a
  // free that reached this memory would release it.
  const live = new Regex('b+');
  before.free();
  assert.ok(before.freed);
  new Regex('zzzz');
  assert.equal(live.exec('abbbc')?.[0], 'bbb');
});

test('long subjects iterate in linear time', () => {
  const subject = 'x'.repeat(200_000);
  const start = performance.now();
  let n = 0;
  for (const _ of new Regex('x').matchAll(subject)) n++;
  assert.equal(n, 200_000);
  // Quadratic re-validation of the subject would take minutes here.
  assert.ok(performance.now() - start < 5000);
});
