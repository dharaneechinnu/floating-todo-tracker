# Product roadmap

## Who this is for

The app started as a personal todo bubble, but the features that actually
got built — PR numbers, a Blocked flag, login/logout status reports with
collaborations and blockers — describe a narrower, more specific user:

> **An engineer at a large company**, working a queue of tickets across a
> sprint, who has to answer "what am I working on?" out loud at least twice
> a day (standup, EOD update) and has a manager who asks "is anything
> blocked?"

That persona, not "someone who needs a grocery list," is what this roadmap
optimises for. The competition isn't Todoist — it's the Jira tab the user
doesn't want to keep open, and the Notes.app scratchpad they actually use
instead.

## The job the product does

Three moments matter, in this order:

1. **Capture** — a task arrives (Slack, a review comment, a hallway ask)
   and must land somewhere in under three seconds, or it goes in the void.
2. **Triage** — "what do I do next?" answered at a glance, without opening
   a ticket tracker.
3. **Report** — turn the day's state into something you can paste into a
   standup channel without rewriting it.

Capture and report are already strong. **Triage is the gap** — every task
in the list currently looks exactly as important as every other one, and
the list has no notion of when anything is due. That's what shipping first.

## Prioritised feature list

Ranked by (user value) ÷ (effort), for the persona above.

### P0 — the triage gap

**1. Task priority (P0–P3)**
Every engineer at a big company already thinks in priority labels; the
list should too. Without it, a 40-item list is an undifferentiated wall
and the user falls back to memory for what's urgent.
*Status: shipping in this PR.*

**2. Due dates with overdue/today signalling**
Sprint commitments have dates. The single most valuable thing a task list
can tell you unprompted is "this one is late." Needs to be visible without
opening the task.
*Status: shipping in this PR.*

**3. Sort and filter by triage state**
Priority and due dates are inert unless you can reorder around them —
"show me what's overdue", "sort by priority". Enables 1 and 2.
*Status: shipping in this PR.*

### P1 — safety and trust

**4. Undo for destructive actions**
Today, delete / bulk-delete / clear-completed are **permanent and
instant**. There is no trash, no undo, no export. One misclick on "Delete"
in bulk-select mode silently destroys a day of tracked work. This is the
biggest correctness risk in the product and the reason it can't yet be
recommended for anything load-bearing.
*Recommend: a 5-second undo toast, plus a soft-deleted trash bucket.*

**5. Export / import (JSON)**
The data lives in one `electron-store` JSON file with no backup path.
Uninstalling, or moving machines, loses everything. Also unblocks users
who want to script against their own data.

**6. Richer status than done/not-done**
The login/logout report already implies a workflow — In Progress,
Blocked, Completed — but the model only has two booleans (`done`,
`blocked`). A real status enum (To Do / In Progress / In Review / Blocked
/ Done) would make reports accurate instead of approximate, and matches
how the persona's ticket tracker already works.

### P2 — daily-loop polish

**7. Global keyboard shortcut for quick capture**
The capture moment is the whole product, and it currently requires
finding and clicking a 22px sliver of bubble. A global hotkey that opens
the panel focused on the input would cut capture to well under three
seconds.

**8. Recurring tasks**
"Post standup update", "Fill timesheet" — the same handful of tasks every
day or every week. Currently retyped or left permanently unchecked.

**9. Task notes / subtasks**
One line is not enough for a real ticket. A notes field (already
half-present as the unused `feedback` field) would hold context, repro
steps, or links.

**10. Time tracking per task**
Large-company timesheet culture. Start/stop a timer on a task, and the
logout report gains real numbers instead of a task list.

### P3 — later, once the loop is solid

**11. Projects / tags**
Grouping across workstreams. Only worth it once list sizes justify it —
premature for a list that's usually under 20 items.

**12. Completed-task history / archive**
"What did I ship this quarter?" — valuable at review time, but the
archive has to be built on top of the soft-delete work in #4 rather than
before it.

## Explicitly not doing

- **Cloud sync / accounts / multi-device.** The product's promise is a
  local, private, zero-setup tool. Sync means a backend, auth, a privacy
  policy, and support load — a different product.
- **Jira/Linear two-way integration.** Tempting for the persona, but it
  turns the app into a client for someone else's API, with their auth and
  their rate limits, and it undermines the "faster than opening the
  ticket tracker" pitch.
- **Team/shared lists.** Same reasoning as sync.

## Why this PR ships 1–3 together

They are one feature, not three. Priority with no way to sort by it is
decoration; sorting with nothing to sort on is an empty control. Shipping
any one alone would be a half-feature the user can't act on, so they land
as a single coherent "triage" slice.
