---
description: Check that the current branch is ready for a pull request — lint, build, tests, review and description
argument-hint: "[base-branch]"
---

Make sure the current branch is ready for a pull request against this base branch: $ARGUMENTS (if empty, use the repository's default branch).

1. `git fetch` and confirm the branch is up to date with its base, with no merge conflicts.
2. Detect and run the project's own checks (from `package.json` scripts, `Makefile`, `pyproject.toml` and so on): **lint, type-check, build and tests**. Report the real outcome of each command; never claim a pass you didn't see.
3. Scan the diff for debug leftovers (`console.log`, `debugger`, `print(`, `TODO` added in this branch), committed secrets or `.env` files, and large binaries.
4. Run the `code-reviewer` agent on the diff.
5. Draft a PR title and description: what changed and why, how it was tested, screenshots needed (yes/no), risk and rollback. Mirror the repo's PR template if one exists.

Finish with a table showing ✅/❌ for each check, then **Ready** or the list of what's blocking. Don't open the PR unless the user asks.
