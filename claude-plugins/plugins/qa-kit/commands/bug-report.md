---
description: Turn a rough bug description into a reproducible, triaged bug report (and optionally a GitHub issue)
argument-hint: "<what went wrong>"
---

Write a bug report for: $ARGUMENTS

1. Try to locate the cause in the codebase (search for the relevant UI text, handler or error message) and name the suspected `file:line`.
2. Write the report: Title · Severity (S1–S4) with the reason · Environment · Steps to reproduce · Expected · Actual · Evidence needed · Suspected area · A regression test idea that would catch it.
3. Show the report, then ask whether to file it as a GitHub issue through the GitHub MCP tools. Don't file it without a yes.
