---
description: Run the development-to-production readiness checklist and give a GO / NO-GO verdict
argument-hint: "[stage name | 'all'] [version or branch]"
---

Run the ship checklist. Arguments: $ARGUMENTS

- With no arguments, or `all`: run every stage with the `release-manager` agent.
- With a stage name (`design`, `dev`, `review`, `qa`, `security`, `release`, `deploy` or `post`): check only that stage, and the stages before it as a short summary.

Save the full report to `docs/releases/<version-or-date>-ship-check.md` so there is an audit trail, then show the verdict and the blockers.
