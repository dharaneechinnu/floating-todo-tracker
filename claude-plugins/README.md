# product-lifecycle — Claude Code plugins

A Claude Code plugin marketplace with one plugin per role. Together they take a product from **design → development → QA → production**.

| Plugin | For | Commands | Agent | Skill | MCP server |
|---|---|---|---|---|---|
| [`design-kit`](plugins/design-kit) | Designers | `design-review`, `design-handoff` | `ui-ux-reviewer` | `design-system-audit` | Figma |
| [`dev-kit`](plugins/dev-kit) | Developers | `feature-plan`, `pr-ready` | `code-reviewer` | `dev-standards` | GitHub |
| [`qa-kit`](plugins/qa-kit) | QA testers | `test-plan`, `smoke-test`, `bug-report` | `qa-engineer` | `qa-test-design` | Playwright |
| [`ship-checklist`](plugins/ship-checklist) | Release owner | `ship-check`, `release-notes` | `release-manager` | `production-readiness` | (uses GitHub) |

## The flow

```
 Designer                Developer               QA                      Release
 ────────                ─────────               ──                      ───────
 /design-review   ──►    /feature-plan    ──►    /test-plan       ──►    /ship-check
 /design-handoff         (code)                  /smoke-test             /release-notes
   docs/handoff/         /pr-ready               /bug-report               docs/releases/
                           docs/plans/             docs/qa/
```

Each stage writes its output into `docs/` in the project, and the next stage reads it. For example, the handoff's acceptance criteria become QA's test cases, and the QA sign-off becomes evidence in the ship check.

## Install

From inside Claude Code:

```
/plugin marketplace add dharaneechinnu/claude-product-lifecycle   # once it has its own repo (see below)
/plugin install design-kit@product-lifecycle
/plugin install dev-kit@product-lifecycle
/plugin install qa-kit@product-lifecycle
/plugin install ship-checklist@product-lifecycle
```

Until then, install from a local checkout: `/plugin marketplace add ./claude-plugins`.

Install only the plugins your role needs. A designer doesn't need Playwright, and QA doesn't need Figma.

## Connecting the MCP servers

| Server | Plugin | Setup |
|---|---|---|
| Figma | design-kit | Run `/mcp`, select **figma**, sign in (OAuth) |
| GitHub | dev-kit | `export GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_...` (fine-grained token with contents, issues and pull requests) before starting `claude` |
| Playwright | qa-kit | Needs Node 18+. Run `npx playwright install chromium` once if no browser is present |

Check the connections with `/mcp`. Every command still works without its server: it falls back to code, `git` and local commands, and tells you what it couldn't check.

## Per-project setup

Copy `plugins/ship-checklist/templates/ship-checklist.md` to `.claude/ship-checklist.md` in your project and fill in your real branches, commands and platforms.

## Moving this into its own GitHub repo

This marketplace is self-contained, so it can be split out with its history:

```bash
# in floating-todo-tracker
git subtree split --prefix=claude-plugins -b plugins-only
# create an empty repo on GitHub, e.g. dharaneechinnu/claude-product-lifecycle, then:
git push git@github.com:dharaneechinnu/claude-product-lifecycle.git plugins-only:main
```

## Validate

```bash
claude plugin validate ./claude-plugins
for p in claude-plugins/plugins/*; do claude plugin validate "$p"; done
```

## Roadmap
- **v0.2**: hooks. Warn on `git push` to a production branch when there's no passing ship-check report for HEAD, and run lint after edits.
- **v0.3**: a `pm-kit` (PRD writing, roadmap grooming) and Jira/Linear MCP options alongside GitHub Issues.
- **v0.4**: a `claude plugin eval` suite for each plugin, so changes to prompts are regression-tested.
