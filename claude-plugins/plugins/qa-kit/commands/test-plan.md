---
description: Write a risk-based test plan for a feature, PR or release
argument-hint: "<feature | PR number | 'release'>"
---

Write a test plan for: $ARGUMENTS

Gather context from the PR (GitHub MCP if available), `docs/plans/`, `docs/handoff/` and the diff. Use the `qa-test-design` skill. Write the plan to `docs/qa/<slug>-test-plan.md` with:

1. Scope, and what is explicitly not tested.
2. A risk table: area × likelihood × impact → test depth.
3. Test cases in a table: ID, title, preconditions, steps, expected result, type (auto/manual), priority.
4. Regression set: existing features this change touches.
5. Environments and test data needed.
6. Exit criteria (for example: no open S1/S2 defects, every P1 case passes).

Then ask whether to run the automatable cases now, using the `qa-engineer` agent.
