---
description: Draft user-facing release notes and a changelog entry from the commits since the last release
argument-hint: "[from-ref] [to-ref]"
---

Draft release notes. Refs: $ARGUMENTS. If none are given, go from the latest tag (`git describe --tags --abbrev=0`) to `HEAD`.

1. Read `git log <from>..<to>` along with the merged PR titles and bodies (GitHub MCP if available).
2. Group the changes under **New**, **Improved**, **Fixed** and **Breaking / action needed**. Write in plain user language: describe what the user notices, not internal refactors. Leave out chores, CI and docs-only commits unless they are user-visible.
3. Suggest the semver bump: breaking → major, new feature → minor, fixes only → patch.
4. Output two blocks: the **GitHub Release body** and a `CHANGELOG.md` entry in Keep a Changelog format. Offer to prepend the entry to `CHANGELOG.md`, and don't write it without a yes.
