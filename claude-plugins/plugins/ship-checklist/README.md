# ship-checklist

The development-to-production gate for Claude Code.

| Component | Type | What it does |
|---|---|---|
| `/ship-checklist:ship-check [stage] [version]` | command | Runs the eight-stage checklist with real evidence, saves an audit report, and gives GO / NO-GO |
| `/ship-checklist:release-notes [from] [to]` | command | User-facing release notes, a changelog entry and a semver suggestion |
| `release-manager` | agent | Collects the evidence and gives the verdict |
| `production-readiness` | skill | The checklist: design → dev → review → QA → security → release prep → deploy → post-release |

## Per-project setup

Copy `templates/ship-checklist.md` to `.claude/ship-checklist.md` in your project and fill in your real branches, commands and platforms. The checklist reads it first.

## MCP

This plugin doesn't start an MCP server of its own. It uses GitHub (from `dev-kit`) for CI and PR evidence when it's connected, and falls back to `git` and local commands when it isn't.
