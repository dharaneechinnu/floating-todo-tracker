---
description: Turn a design (a Figma frame or a description) into a developer handoff spec
argument-hint: "<figma-url | feature description>"
---

Produce a developer handoff spec for: $ARGUMENTS

Pull the design from the Figma MCP server if a link was given. Map everything you can onto the tokens and components that already exist in this repo (search the codebase first; name the real file or component). Write the spec to `docs/handoff/<feature-slug>.md` with these sections:

1. **Goal and user story**, in one or two sentences.
2. **Screens and states** — default, empty, loading, error, success, disabled, and hover/focus/active for each interactive element.
3. **Layout and tokens** — spacing, type, colour and radius, given as token names, never as raw hex values where a token exists. List any *new* token that is needed as a gap.
4. **Components** — reused (with the file path), changed, or new.
5. **Interactions and motion** — triggers, durations, easing, and the reduced-motion fallback.
6. **Accessibility** — focus order, ARIA roles and labels, keyboard shortcuts, and contrast checks.
7. **Copy** — every user-visible string.
8. **Acceptance criteria**, written so QA can test them directly (Given/When/Then).
9. **Open questions** for the designer.
