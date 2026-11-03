# dev-kit

Developer workflows for Claude Code.

| Component | Type | What it does |
|---|---|---|
| `/dev-kit:feature-plan <feature or #issue>` | command | Writes a codebase-grounded implementation plan to `docs/plans/` and stops for approval |
| `/dev-kit:pr-ready [base]` | command | Runs lint, type-check, build and tests, scans for leftovers and secrets, reviews the diff, drafts the PR description |
| `code-reviewer` | agent | Correctness- and security-focused review of a diff or PR |
| `dev-standards` | skill | Conventions Claude applies while writing code |

## MCP: GitHub

`.mcp.json` connects GitHub's remote MCP server. Create a fine-grained personal access token (repository contents, issues and pull requests) and export it before you start Claude Code:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_...
```

Without it, the plugin falls back to plain `git` for everything that doesn't need issues or PRs.
