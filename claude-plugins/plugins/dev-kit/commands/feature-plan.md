---
description: Turn a feature request or issue into an implementation plan grounded in this codebase
argument-hint: "<feature description | issue number>"
---

Plan the implementation of: $ARGUMENTS

If it's an issue number, read the issue with the GitHub MCP tools. Explore the codebase before you plan: find the files, patterns and conventions this change has to fit. Then write the plan to `docs/plans/<feature-slug>.md`:

1. **Problem and outcome** — what changes for the user, and how we'll know it worked.
2. **Scope** — in scope, and explicitly out of scope.
3. **Design** — the approach, with the real files and functions to touch, any data and schema changes, and API/IPC/contract changes.
4. **Steps** — small, ordered, independently reviewable commits.
5. **Testing** — unit, integration and manual checks; hand the edge cases on to QA.
6. **Risks and rollback** — what could break, feature flags, and how to revert.
7. **Checklist hooks** — which stages of the ship checklist (`/ship-checklist:ship-check`) this change will need to pass.

Stop after the plan and ask for approval before writing any code.
