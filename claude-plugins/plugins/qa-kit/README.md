# qa-kit

QA workflows for Claude Code.

| Component | Type | What it does |
|---|---|---|
| `/qa-kit:test-plan <target>` | command | A risk-based test plan written to `docs/qa/`, with exit criteria |
| `/qa-kit:smoke-test <url> [flows]` | command | A fast Playwright run over the critical flows, with screenshots of failures |
| `/qa-kit:bug-report <description>` | command | A reproducible, triaged bug report, optionally filed as a GitHub issue |
| `qa-engineer` | agent | Designs and runs cases, and gives a Go/No-go sign-off |
| `qa-test-design` | skill | Boundary, state, interruption and persistence techniques |

## MCP: Playwright

`.mcp.json` starts `@playwright/mcp` with `npx`. It needs Node 18+ and a browser. If no browser is installed, run `npx playwright install chromium` once.
