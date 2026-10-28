---
type: how-to
---

# Development

How to set up a checkout, run the gates, and find the cause of a failure. The
rules are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Set up

1. Install the Node version in `.nvmrc`: `nvm install`.
2. Install the dependencies: `npm ci`.

To rebuild `pcre2.wasm`, follow [building.md](building.md).

## Run the gates

[CONTRIBUTING.md](../CONTRIBUTING.md#pull-requests) gives the five gates. CI
runs the same commands.

To run one test file, use `npx vitest run src/path/to/file.test.ts`. To run
the tests that have a name, use `npx vitest run -t "part of the name"`.

To run a shared check locally, clone `shared-workflows` next to this
repository, and run its script from here:

```bash
node ../shared-workflows/.github/actions/docs-check/docs-check.mjs
```

## Traps

Add a trap here when it costs a contributor time and a check cannot find it.
Give the symptom first, then the cause, then the fix. If a trap belongs to an
area, put it in the topic file of that area: [ci.md](ci.md),
[testing.md](testing.md), [code-style.md](code-style.md),
[dependencies.md](dependencies.md), [documentation.md](documentation.md) or
[building.md](building.md).
