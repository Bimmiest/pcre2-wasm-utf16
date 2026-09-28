// What `npm pack` would ship, checked against what must and must not be in it.
// A git dependency installs exactly this set, so it is also what every
// consumer gets. The licence files are the point: pcre2.wasm is a binary
// redistribution of PCRE2, whose licence requires its notices to travel with
// it, so a `files` list that dropped them would put every install out of
// compliance without failing anything else.
import { execFileSync } from 'node:child_process';

const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const shipped = new Set(pack.files.map((f) => f.path));

const required = [
  'LICENSE',
  'LICENCE-PCRE2.md',
  'NOTICE',
  'README.md',
  'package.json',
  'pcre2.wasm',
  'pcre2.wasm.sha256',
  'src/index.ts',
  'build/build.sh',
];
// Development-only material has no business in an install.
const forbidden = [/^test\//, /^scripts\//, /^\.github\//, /^node_modules\//, /^coverage\//, /^reports\//, /^\.stryker-tmp\//, /config\.(m?js|ts)$/];

const problems = [
  ...required.filter((path) => !shipped.has(path)).map((path) => `missing: ${path}`),
  ...[...shipped].filter((path) => forbidden.some((re) => re.test(path))).map((path) => `should not ship: ${path}`),
];
if (problems.length > 0) {
  console.error(`The package's contents are wrong:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`${pack.name}@${pack.version}: ${shipped.size} files, ${pack.size} bytes packed; licence files present.`);
