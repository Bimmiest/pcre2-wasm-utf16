---
type: reference
---

# Dependencies

The rules for dependencies. CONTRIBUTING.md has the summary.

- **Use a caret range. The lockfile is the pin.** Write the reason next to
  each exception (for example, the `~` on `typescript`).
- **Declare a package where you import it.** In a repository with
  workspaces, declare each package in the workspace that uses it, not also at
  the root. Use one range for each name across all manifests.
- **Dependabot** proposes updates each week, with a seven-day cooldown. It
  groups minor and patch updates, and proposes each major on its own. Each
  `ignore` entry in `.github/dependabot.yml` has its reason.
- **Read each advisory. Do not apply fixes automatically.** One time,
  `npm audit fix --force` proposed to move a dependency thirteen minor
  versions back. If a high advisory has no path that the code can reach,
  list it in `.audit-exceptions.json` with the reason and an expiry date. An
  entry that has expired, or that no advisory needs, fails CI.
- **An override has a reason and an issue that removes it.** `typed-rest-client`
  → `qs` lifts the `qs` 6.15.1 that Stryker's `typed-rest-client` pins
  exactly past its advisories. It is a development dependency only. Drop it
  when Stryker depends on a fixed `typed-rest-client` ([#35](https://github.com/Bimmiest/pcre2-wasm-utf16/issues/35)).
- **Licences.** The licence of each production dependency is on
  `.licence-allowlist.json`. Otherwise the file names the package, the
  version that a person read, and why it is acceptable.
- **Pin a git dependency to a commit**, not a tag, because a tag can move.
  The dependency ships a checksum that CI verifies.
- **CI does not run install scripts** (`npm ci --ignore-scripts`). If a
  dependency needs its install script, name it in the workflow with the
  reason.
- **Node** has an exact version in `.nvmrc`. `engine-strict=true` in
  `.npmrc` holds local installs to `engines`. Here, `engines` stays at
  `>=22.6.0`, because consumers read it too, and the library uses no Node
  API ([ADR 0003](adr/0003-the-package-adopts-the-template-and-keeps-its-own-build.md)). CI fails a
  pull request when `.nvmrc` is not in the range of `engines`. The lower
  bound of `engines` can be on an older major than `.nvmrc`, because it
  gives the Node versions of the users. CI warns on a pull request, and
  fails each month, when `.nvmrc` is behind the newest patch of its line, or
  when its line ends in fewer than 90 days. Move the major of `@types/node`
  with `.nvmrc`, not before it.
- **Pin each action to a commit SHA**, with the version in a comment after
  it. Dependabot reads the comment and updates the SHA and the comment
  together. The owner of a tag can move it while a job holds a checkout.
- **A release of `shared-workflows` comes after the cooldown.** Dependabot
  proposes a tag only when it is seven days old, at the next weekly run.
  Thus a release can wait up to 14 days for its pull request. When a release
  must come earlier, move all its pins by hand in one change, and do what
  its CHANGELOG entry tells a consumer to do.
