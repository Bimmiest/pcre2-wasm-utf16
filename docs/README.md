---
type: reference
---

# Documentation

Each topic file in `docs/`, in path order. When you add, rename or remove a
file, change its row here: the docs check fails a file that has no row. The
documents at the root are listed in the [README](../README.md#documentation).

| Document | What it holds |
|---|---|
| [adr/README.md](adr/README.md) | The decisions, and why we made them |
| [api.md](api.md) | How to load the module, the `Regex` API, the flags, the semantics, the limits and the memory |
| [building.md](building.md) | How `build/build.sh` makes `pcre2.wasm`, how CI proves it, and how to upgrade PCRE2 |
| [ci.md](ci.md) | Each CI job, what makes it fail, and where its rule is |
| [code-style.md](code-style.md) | The rules for the layout, the lint and the types |
| [dependencies.md](dependencies.md) | The rules for dependencies |
| [development.md](development.md) | How to set up a checkout, run the gates, and the traps |
| [documentation.md](documentation.md) | Where each text goes, the line limits, the topic types and the STE rules |
| [repository-settings.md](repository-settings.md) | The repository settings that are not files, and that `settings.yml` checks |
| [testing.md](testing.md) | The rules for tests, what each test file tests, and how to read a mutation run |
