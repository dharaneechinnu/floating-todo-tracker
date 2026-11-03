---
description: Review a screen, component, Figma frame or UI diff for UX, consistency and accessibility
argument-hint: "[figma-url | file-path | 'diff']"
---

Review the design target: $ARGUMENTS

- If it's empty or `diff`, review the UI files changed on this branch (`git diff --name-only origin/HEAD...HEAD`, keeping only styles, components and templates).
- If it's a Figma URL, use the Figma MCP tools to fetch that frame.
- Otherwise treat it as a path or a description of a screen.

Hand the actual review to the `ui-ux-reviewer` agent, then present its findings table. End with a single line: **Ready for handoff**, or **Needs another pass** with the blocker count.
