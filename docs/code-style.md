---
type: reference
---

# Code style

The rules for the layout, the lint and the types of the code, with their reasons. CONTRIBUTING.md has the summary.

- **Prettier controls the layout** (`npm run format`). The configuration is
  `.prettierrc.json`. Put generated files in `.prettierignore`, with the name
  of the script that makes them.
- **ESLint finds mistakes.** The preset is typescript-eslint
  `strictTypeChecked`, with type information. Each rule that differs from
  the preset has its reason next to it in `eslint.config.js`. If a rule is
  wrong for this code, turn it off there, with a sentence that says why. Do
  not use `eslint-disable` at the call site. One deliberate exception (for
  example, a deprecated API that you use on purpose) gets an inline disable
  that says so.
- **Do not use `!` in code that ships.** Narrow the type instead: destructure
  the value, iterate instead of index, or compare with `undefined`. Tests can
  use `!`. The `!` that existed before this rule are on
  `scripts/lint-allowlist.json`.
- **The library uses the globals of no environment.** It runs in a browser,
  a worker and Node. `npm run build` and lint fail on a Node or DOM global in
  `src/index.ts`.
- **A `switch` over a union has no `default`.** Then the exhaustiveness rule
  makes a new member a compile error at each `switch`.
- **Size limits:** 100 lines for each function and a cyclomatic complexity of
  25. Blank lines and comments do not count, so continue to write the
  reasons. Tests do not have these limits.
- **Imports** are in three groups: Node built-ins, packages, then the files
  of the project. `eslint --fix` sorts them.
- **A layer that must stay pure** (for example a simulation engine or a
  parser) gets a `no-restricted-imports` block. The block names what the
  layer must not import, and why. A test lints a real import line against
  the rule, so that a change to the configuration cannot stop the rule
  without a failure. `eslint.config.js` has a commented example of the block.
- **When you adopt a rule over existing code**, list the findings of that
  day in an allowlist, by file and by rule. A test holds the list. New
  code gets no exceptions. The list only gets shorter. When you fix a listed
  finding, lower its count in the same change.
- **TypeScript** is strict, with the extra flags in `tsconfig.base.json`.
  Each flag has its reason. Pin `typescript` with `~`, not `^`: TypeScript
  does not follow semantic versioning, and it moves with typescript-eslint.
