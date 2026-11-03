---
name: qa-test-design
description: Test-design techniques for turning a feature into thorough test cases — equivalence partitions, boundary values, state transitions, error guessing, and a regression checklist. Use when writing test cases, a test plan, or acceptance tests, or when deciding what to test.
---

# Test design

## Techniques to apply to every input and flow
- **Equivalence partitions**: one case per class of valid input and per class of invalid input.
- **Boundary values**: min−1, min, min+1, max−1, max, max+1; the empty string, whitespace only, a very long string, unicode and emoji, and leading/trailing spaces.
- **State transitions**: draw the states (for example empty → has items → all done) and test every allowed transition, plus one transition that isn't allowed.
- **Collections**: 0, 1, many, and the maximum (does it scroll, paginate or truncate?).
- **Time**: midnight, timezone offsets, DST change days, leap day, sleep and wake, a slow clock.
- **Interruption**: reload mid-action, close and reopen, offline, double-submit, rapid repeated clicks, back and forward.
- **Persistence**: does the data survive a restart or upgrade? Is old stored data still read correctly?
- **Permissions and roles**, if there's auth: signed out, wrong role, an expired session.
- **Accessibility**: keyboard only, screen-reader labels, zoom to 200%.

## Priority
- **P1**: the core flow, data loss, security, anything in the acceptance criteria.
- **P2**: common edge cases and the regression area.
- **P3**: rare or cosmetic.

## Case format
`ID | Title | Preconditions | Steps | Expected | Type (auto/manual) | Priority`. Expected results must be observable ("the row shows a strikethrough"), never vague ("it works").
