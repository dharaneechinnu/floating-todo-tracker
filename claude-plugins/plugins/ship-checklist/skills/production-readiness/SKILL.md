---
name: production-readiness
description: The staged development-to-production checklist — design, development, code review, QA, security, release prep, deploy and post-release — with the evidence each item needs. Use when someone asks whether something is ready to ship or release, wants a launch or go-live checklist, or is moving a change from dev to staging to production.
---

# Production-readiness checklist

A change moves through eight gates. Each item is **✅ done (with evidence)**, **❌ not done**, **⏭ N/A (with a reason)** or **❓ unknown**. Unknown counts as not done. Never tick an item without evidence you actually saw: a command's output, a file, a PR, a CI run.

**Project overrides:** if the repo has `.claude/ship-checklist.md`, read it first. It names the project's real branches, environments, commands and extra items, and it takes precedence over the generic wording below.

## 1. Design ready
- [ ] Acceptance criteria written (Given/When/Then), in a plan, handoff spec or issue
- [ ] Every UI state designed: empty, loading, error and success
- [ ] Accessibility reviewed (`/design-kit:design-review`): no blockers
- [ ] Copy final

## 2. Development complete
- [ ] Every acceptance criterion implemented
- [ ] Lint, type-check and build pass locally *and* in CI
- [ ] Tests added or updated for the new behaviour; the suite passes
- [ ] Persisted-data and schema changes have defaults and a migration; existing user data still loads
- [ ] Config, env vars and feature flags documented
- [ ] No debug leftovers, secrets or stray TODOs in the diff

## 3. Code review
- [ ] PR open with a description: what, why, how tested, risk
- [ ] Reviewed (`code-reviewer` agent and a human), with no unresolved Critical/High findings
- [ ] Branch up to date with its base; no conflicts

## 4. QA sign-off
- [ ] Test plan exists (`/qa-kit:test-plan`); every P1 case passes
- [ ] Regression area checked
- [ ] No open S1/S2 defects
- [ ] Tested on every target platform and browser (list them)

## 5. Security and compliance
- [ ] Dependency audit (`npm audit`, `pip-audit` or similar): no high/critical issues without a fix or an accepted risk
- [ ] Input is validated at the trust boundary; no new injection paths
- [ ] Secrets live in a secret store or CI secrets, never in the repo
- [ ] Licences of new dependencies are compatible
- [ ] Privacy: no new collection of personal data, or it is disclosed

## 6. Release prep
- [ ] Version bumped following semver; the changelog and release notes are drafted (`/ship-checklist:release-notes`)
- [ ] Docs and README updated for user-visible changes
- [ ] Rollback plan written: the exact revert or redeploy step, and whether data migrations can be reversed
- [ ] Staging or the test channel deployed and smoke-tested (`/qa-kit:smoke-test`)
- [ ] Stakeholders told the release window

## 7. Deploy
- [ ] Deployed through the pipeline, not by hand
- [ ] The release artifact or tag matches the reviewed commit SHA
- [ ] A post-deploy smoke test passes in production

## 8. Post-release
- [ ] Monitoring, error rates and crash reports watched for the agreed window
- [ ] Release announced; issues and tickets closed and linked
- [ ] Retro notes captured if anything went wrong

## Verdict rules
- **GO**: stages 1–6 have no ❌ or ❓ (N/A items have their reason given).
- **GO with risk**: only low-impact items are open, each with a named owner and an accepted risk.
- **NO-GO**: any open item in stage 2, 4 or 5, or no rollback plan.
