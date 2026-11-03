---
description: Run a fast browser smoke test against a URL with Playwright and report what broke
argument-hint: "<url> [critical flows to check]"
---

Smoke-test: $ARGUMENTS

Use the `playwright` MCP tools:

1. Open the URL. Record load errors, console errors and failed network requests.
2. Exercise the critical flows that were named. If none were named, find the primary navigation and the main call-to-action and walk each one.
3. Check one narrow viewport (390×844) as well as the desktop size.
4. Take a screenshot of every failure.

Report a table with one row per flow (✅/❌, with notes), then the console errors, then defects in the `qa-engineer` defect format. Keep it fast. This is a smoke test, not full regression.
