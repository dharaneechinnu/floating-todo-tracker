---
name: design-system-audit
description: Audit a codebase's UI for design-system drift — hard-coded colours, off-scale spacing, duplicate components and contrast failures. Use when asked to audit, clean up or standardise the design system, find inconsistent styling, or check theme and token usage.
---

# Design-system audit

Find where the UI has drifted away from its own design system, and report it as a backlog that can be fixed.

## Steps

1. **Find the source of truth.** Look for tokens: CSS custom properties on `:root`, `theme.(js|ts)`, `tailwind.config.*`, `tokens.json`, or Figma variables via the Figma MCP server. If none exist, say so. That is finding #1.
2. **Scan for drift** (use `grep -rnE` across style and component files, excluding `node_modules`, `dist` and build output):
   - Raw colours: `#[0-9a-fA-F]{3,8}\b`, `rgb\(`, `hsl\(` outside the token file.
   - Off-scale spacing: `px` values that aren't on the scale (for example, not a multiple of 4).
   - Ad-hoc font sizes and font families.
   - z-index values above the token set.
   - Near-duplicate components (for example `Button`, `Btn`, `PrimaryButton` in different folders).
3. **Check contrast** for each foreground/background token pair that the UI actually uses. Calculate the WCAG relative-luminance ratio and flag anything below 4.5:1 for text or below 3:1 for UI parts.
4. **Check both themes** if a dark mode exists: every token must be redefined, not left inheriting the light value.

## Report

- A summary that counts each type of drift.
- A table: file:line, the offending value, the token it should be, and the effort (S/M/L).
- The five fixes with the most impact first. Don't change files unless the user asks you to.
