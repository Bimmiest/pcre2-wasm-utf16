---
type: reference
---

# CI

Each CI job, what makes it fail, and where its rule is. CONTRIBUTING.md has the rules.

| Job | What makes it fail | Where the rule is |
|---|---|---|
| `verify` | Lint, format, types, the test suite and its coverage floor, a floor that is out of date, the build, the contents of the package, the documentation checks of [documentation.md](documentation.md), and the licences of production dependencies | The scripts in `package.json`, `vitest.config.ts`, `scripts/check-package-contents.mjs`, `.docs-check.json`, `.licence-allowlist.json` |
| `wasm` | A rebuilt `pcre2.wasm` that is not byte-identical to the committed file, or a warning in the C of this repository | `build/build.sh`, [building.md](building.md) |
| `audit` | A high or critical advisory in a production dependency, with no exception | `.audit-exceptions.json` |
| `dependency-review` | A pull request that adds a dependency with a high advisory | The GitHub dependency graph |
| `workflow-lint` | actionlint and zizmor findings in `.github/` | The workflows |
| `PR hygiene` | A branch or an issue link that does not follow the convention. A change to a shipped file with no `CHANGELOG.md` entry, unless the pull request has the label `no-changelog` | [CONTRIBUTING.md](../CONTRIBUTING.md#branches), `pr-hygiene.yml` |
| `Security` | A secret anywhere in the history, or a fixable CRITICAL or HIGH vulnerability or misconfiguration in the tree | `.gitleaks.toml`, `.trivyignore.yaml` |
| `Scorecard` (weekly and on `main`) | Nothing. It reports the OpenSSF Scorecard checks, to the README badge and to code scanning | The repository settings and the workflows |
| `Mutation` (weekly, and on a pull request that changes `src/`) | A mutation score below the floor in `stryker.config.mjs`. It is not a required check | [testing.md](testing.md) |
| `Settings` (weekly) | A repository setting that differs from the checklist, or that the token cannot read. A failure opens an issue | `.repo-settings.json` |

Each job can fail independently, on purpose: a new advisory must not hide the
result of the test suite. If the repository gets a browser suite, it is a job
of its own for the same reason.
