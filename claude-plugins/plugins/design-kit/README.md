# design-kit

Designer workflows for Claude Code.

| Component | Type | What it does |
|---|---|---|
| `/design-kit:design-review [target]` | command | UX, consistency and WCAG 2.2 AA review of a Figma frame, file or the branch's UI diff |
| `/design-kit:design-handoff <target>` | command | Writes a developer handoff spec to `docs/handoff/` with states, tokens and acceptance criteria |
| `ui-ux-reviewer` | agent | The reviewer behind `/design-review`, and usable on its own |
| `design-system-audit` | skill | Finds hard-coded colours, off-scale spacing, duplicate components and contrast failures |

## MCP: Figma

`.mcp.json` connects Figma's remote MCP server (`https://mcp.figma.com/mcp`). The first time you use it, run `/mcp` in Claude Code, select **figma** and sign in with OAuth. Without Figma, everything still works on code, screenshots and descriptions.
