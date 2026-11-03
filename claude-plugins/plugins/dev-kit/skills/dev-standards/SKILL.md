---
name: dev-standards
description: Engineering conventions to apply when writing or changing code — small commits, tests with every behaviour change, safe migrations, no secrets, conventional commit messages. Use whenever implementing a feature, fixing a bug or refactoring, so the change arrives ready for review and QA.
---

# Development standards

Apply these whenever you write code. Where the project's own `CLAUDE.md` or `CONTRIBUTING.md` disagrees, the project wins.

## Before coding
- Read the files you'll change, and their callers. Follow the patterns that already exist rather than adding new ones.
- For anything bigger than a small fix, get a plan approved first (`/dev-kit:feature-plan`).

## While coding
- Keep each change to what the task needs. Don't do drive-by refactors in the same commit.
- Every behaviour change gets a test, or, where the project has no test suite, written manual verification steps.
- Validate input at the trust boundary (API handler, IPC handler, form submit), not only in the UI.
- Persisted-data changes need defaults for existing records and a migration path. Never silently drop a user's stored data.
- No secrets, tokens or personal data in code, logs, fixtures or commit messages.
- Handle the error path and the empty state, not only the happy path.

## Commits
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, with an imperative subject of 72 characters or fewer and a body that explains *why*.
- One logical change per commit. Each commit should build.

## Handing off
- Run `/dev-kit:pr-ready` before you ask for review.
- Note the edge cases for QA in the PR description, so `/qa-kit:test-plan` can pick them up.
