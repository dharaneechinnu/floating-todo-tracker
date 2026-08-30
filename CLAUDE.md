# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

A small desktop tool: a circular bubble that floats **always on top of every window, on every virtual desktop**. Drag it to any edge of the screen and it **docks there, peeking out** just enough to stay reachable without covering anything. Click it and it opens into a todo list anchored right there; click its ✕ button to collapse it back to the bubble — it stays open otherwise, even if you click into another window. Fully local — no account, no server, no telemetry.

It exists because the owner wanted their todo list to be **physically inescapable** — not a tab you forget to open, not an app you alt-tab to, but a small object always sitting on the edge of the screen. The product is the always-visible, always-reachable bubble; the todo list is what's inside it.

The project has grown past "just a todo list" into something closer to a **personal work-session tracker**: todos can carry a PR number and a "Blocked" flag, and the panel can generate a formatted **login/logout status report** (task list, collaborations, blockers, "task for today") copied straight to the clipboard. That shape — PR numbers, blockers, shareable standup-style reports — suggests this is used to track day-to-day engineering work, not just a generic grocery list. Keep that framing in mind when adding features: "what does someone reporting on their work session need" is now as relevant a lens as "what does a todo app need."

This repo is intentionally separate from `dharaneechinnu/reddyfox` (a Django/React web business site) — this is a desktop app with a completely different runtime (Electron/Node, no backend, no database), so it has nothing to share with that project.

**This project has been built by more than one Claude Code session working independently** (visible in the git history — commits authored `dharaneechinnu` and `Dharan1825`, both attributed to the same person's parallel sessions). Expect the codebase to sometimes carry two independent takes on the same idea (see "the pending-count badge" note below) — when that happens, prefer whichever is already merged into `main` and treat the other as superseded, rather than assuming your own session's earlier work is the current truth.

## What has been built so far

The original phased plan (`PLAN.md`) covered phases 0–5; the project has since grown well beyond that plan's v1 scope. Everything below is merged into `main`:

**Phases 0–5 (the original plan):** scaffold, the floating bubble window, the todo panel UI, `electron-store` persistence, a system tray, and installer packaging.

**Since then:**
- **Edge-docking with "peek."** The bubble no longer just sits wherever you last put it — drag it anywhere and, on release, it snaps to whichever screen edge (`left`/`right`/`top`/`bottom`) it's closest to and rests there showing only ~30% of itself (`PEEK_VISIBLE_RATIO` in `electron/main.js`), the rest clipped naturally by the physical display boundary. It's multi-monitor aware: it won't peek toward a direction where another display sits flush against that edge (`hasAdjacentDisplay`), since there the "hidden" part would just render fully visible on the neighboring screen instead of being clipped.
- **Custom pointer-based dragging**, replacing the original CSS `-webkit-app-region: drag`. That approach couldn't distinguish a click from a drag (a real bug — it swallowed plain clicks, so the panel stopped opening). Now the renderer (`App.jsx`) tracks pointer movement itself past a small threshold (`DRAG_THRESHOLD`) before treating it as a drag, and reports positions to the main process over IPC (`bubble:drag-start/move/end`).
- **Search-as-you-type in the add input** — typing filters the visible list live; only if nothing already matches does pressing Enter add it as a new todo, which also prevents accidental near-duplicates.
- **Double-click to rename** a todo in place.
- **Bulk select** — a "select all" toggle enters a selection mode with checkboxes per row, then Complete or Delete the selection at once.
- **PR number + Blocked fields per todo**, edited inline in the same edit view as renaming; shown as compact badges on the row (`PR #123`, a 🚫 icon).
- **Login/logout report generator** (`src/utils/logoutReport.js`) — builds a formatted plain-text status report from the current todos (numbered, status-emoji per task) plus free-text collaborations/blockers/today's-plan fields, and copies it to the clipboard via Electron's native `clipboard` module (`clipboard:write` IPC, since the renderer has no direct Node access).
- **Clear completed**, and a shared gradient-styled scrollbar applied everywhere the panel scrolls.
- **A pending-count badge on the collapsed bubble** — a small red circle showing how many todos are still open, capped at "99+". Worth noting: this was implemented essentially identically by two independent sessions at nearly the same time (see the "more than one session" note above) — the versions merged cleanly because they were nearly line-for-line the same. It was **originally pinned to the bubble's top-right corner, which made it invisible in the default resting position** — docked right, that corner sits inside the `PEEK_HIDDEN` (50 of 72px) region that hangs off-screen. It's now dock-aware; see "The badge has to follow the dock edge" below.
- **A landing/download site** (`landing/`, a separate Vite+React app) with an interactive demo, a guided product tour, a feature comparison section, and download buttons that read the latest GitHub Release via the GitHub API at load time. Deployed to Vercel; `npm run build` inside `landing/` also still emits a static copy into `docs/` as a GitHub Pages fallback.
- **A three-branch release pipeline** (`main` → `test` → `release`, see `RELEASING.md`) with two GitHub Actions workflows: `test.yml` (lint + build, runs on every push to `main`/`test` and on PRs into `test`/`release`) and `build.yml` (builds Windows/Linux installers and publishes them as a GitHub Release — a rolling `continuous` pre-release on every push to `release`, or a permanent versioned release on a `v*` tag push).
- **macOS was dropped as a build target** (`Remove macOS from the build/release pipeline`) — no `.dmg`, no notarization/signing setup. Only Windows (`.exe` via nsis) and Linux (`.AppImage` + `.deb`) are built and released now.
- **Task triage — priority, due dates, filter and sort.** Each todo carries a `priority` (`p0`–`p3`, or `""`) and a `dueDate` (`YYYY-MM-DD`, or `""`), both edited in the same inline edit view as the PR number and Blocked flag. The row shows a priority chip and a due chip (`Today` / `Tomorrow` / `3d late`), overdue rows get a red rail, and the panel gained a toolbar of filter chips (`All / Open / Late / P0–P1`) and sort chips (`Manual / Priority / Due`). The logic lives in `src/utils/taskMeta.js` as pure functions. See the two architecture notes below before changing any of it.

- **Focus timer (Pomodoro).** A 25/5/15 focus-and-break timer, started per task with the ▶ button on a row. The **main process owns the clock** (`session` in `electron/main.js`) — it must keep running while the panel is collapsed, and it owns notifications and the store. `src/utils/focusTimer.js` holds the pure logic (phase cycle, formatting, remaining-time math). A completed focus session increments `pomodoros` on its task, which surfaces as a 🍅 chip and in the login/logout report. See the two architecture notes below.

**Not yet done:** still no undo or export/import for todos — deleting one, clearing completed, or losing the `electron-store` file loses that data permanently. This is the **highest-priority gap in the product**; see `ROADMAP.md`, which prioritises it as P1 alongside the rest of the planned feature set.

A separate, standalone **interactive browser preview** of the UI was also published as a Claude Artifact during development (not part of this repo, not a build target) — a static page that ports the bubble/panel CSS and behavior so the UI could be reviewed without a desktop build. It has no runtime connection to this codebase and isn't something to keep in sync.

## Commands

```bash
npm install
npm run dev              # Vite dev server + Electron, both together
npm run build             # production Vite bundle only
npm run dist:win          # build + package a Windows installer (nsis)
npm run dist:linux        # build + package Linux installers (AppImage + deb)
npm run lint               # eslint (flat config, eslint.config.mjs)
```

There is no test suite. Verifying a change means running `npm run dev` and actually dragging/docking/clicking the bubble — this is a UI-and-OS-interaction-heavy app where the correctness that matters (does it really stay on top? does docking/peeking look right on this OS? does it survive a restart?) can't be checked by reading code.

The `landing/` site is a separate npm project with its own `package.json`:
```bash
cd landing
npm install
npm run dev      # local dev server for the landing/download page
npm run build    # production build -> ../docs (GitHub Pages fallback)
```

See `RELEASING.md` for the full `main` → `test` → `release` branch workflow and how to cut a real versioned release (`npm version patch/minor/major` on `release`, then push with `--follow-tags`).

## Architecture

```
Electron main process (electron/main.js)
  │
  ├─ owns the one BrowserWindow — the bubble AND the panel are the
  │  same window, just resized between two fixed sizes and repositioned
  │  based on which screen edge it's docked to
  ├─ owns edge-docking/peek geometry (bubbleBoundsForDock, panelBoundsForDock,
  │  nearestDockFromBounds) and custom pointer-drag tracking (dragState)
  ├─ owns the Tray icon
  ├─ owns electron-store (electron/store.js) — the only place data is
  │  read or written
  ├─ owns the system clipboard (for the login/logout report copy action)
  │
  ├─ IPC (via electron/preload.cjs, contextBridge, contextIsolation on)
  │
  React renderer (src/)
    │
    ├─ src/App.jsx — top-level: bubble vs panel, pointer-based
    │  click-vs-drag detection, forwards drag events to main over IPC
    └─ src/components/
        ├─ TodoPanel.jsx — add/search input, the list, bulk-select mode,
        │  the login/logout report view
        └─ TodoItem.jsx — checkbox, double-click-to-edit (text + PR # +
           blocked), delete
```

### Why one window, not two

The bubble and the expanded panel are the *same* `BrowserWindow`, just resized (72×72 ↔ 320×440) and repositioned to grow from whichever edge it's docked to. One window means there's only one set of bounds to keep on-screen and nothing to sync between two windows. The trade-off is a resize instead of a second window sliding in — the better trade for a single-user tool.

### The edge-dock + peek system

This is the most complex part of `main.js` and worth understanding before touching window geometry:

- A **dock** is `{ edge: 'left'|'right'|'top'|'bottom', along: number }` — `along` is the offset from the top (for left/right edges) or from the left (for top/bottom edges) of that edge, in work-area coordinates. It's the single source of truth for where the bubble rests, persisted via `store.set("dock", dock)`.
- **At rest** (`settleBubbleAtDock`), the bubble is positioned so only `PEEK_VISIBLE_RATIO` (30%) of it is on-screen — the other 70% (`PEEK_HIDDEN`) is pushed off the physical display edge, where the OS naturally clips it. This is what makes it "peek" rather than just sit flush against the edge.
- **While dragging**, the bubble follows the pointer directly (`bubble:drag-move`) with no peek offset — it only snaps to a dock and starts peeking again once the drag ends (`bubble:drag-end` → `nearestDockFromBounds` → `settleBubbleAtDock`).
- **Multi-monitor correctness**: `hasAdjacentDisplay` checks whether another display sits flush against the edge the bubble wants to peek toward. If so, peeking is skipped for that edge — the "hidden" 70% would otherwise render fully visible on the neighboring monitor instead of being clipped, which would look broken rather than intentional.
- **Expanding** always opens the panel from the current dock edge (`panelBoundsForDock`), clamped to the display's work area. **Collapsing** re-derives the nearest dock edge from wherever the panel currently is (`nearestDockFromBounds(mainWindow.getBounds())`) before re-docking — this matters because the panel itself can be dragged by its header to a new position before being closed, so the dock on collapse isn't necessarily the dock it was expanded from.

### The focus timer stores a deadline, not a countdown

A running session persists `endsAt` (a wall-clock timestamp), never "minutes remaining". The 1-second interval in `main.js` only drives the *display* — it is never the clock itself. That distinction is what makes the timer survive a laptop sleep, a busy event loop, or a dropped tick: on every read, remaining time is recomputed from `endsAt`, so a 30-minute sleep correctly consumes a 25-minute session rather than leaving it frozen at full. A **paused** session is the mirror image — it has no end time, so it stores `remainingMs` instead, and resuming recomputes `endsAt` from it.

**A focus session is voided on restart, deliberately.** Cirillo's technique says an interrupted pomodoro is void rather than partially credited, and quitting the app mid-session is an interruption — so `restoreSession()` discards a running focus session instead of resuming or counting it. A queued break comes back paused. This is a product rule, not a technical limitation; don't "fix" it into a resume without deciding you want to depart from the method.

### One session at a time

The ▶ button is disabled on every row while any session is live. A second concurrent session would make "which task does this pomodoro belong to?" unanswerable, and the per-task 🍅 count is the feature's whole output. For the same reason, deleting a task that owns the running session stops that session rather than leaving it to credit a task that no longer exists.

### Dual validation for priority and due date

`src/utils/taskMeta.js` (renderer, ESM) and `isIsoDate` / `PRIORITY_IDS` in `electron/main.js` (main process, CommonJS) implement the *same* rules independently — they can't share a module across the ESM/CJS split. The renderer copy is a UX convenience; **the main-process copy in the `todos:patch` handler is the real gate**, because it's what decides what reaches `electron-store`. A malformed priority or date would corrupt sort order for every view, so both are normalised to `""` rather than stored as-is. **Keep the two in step** — a rule change needs both files touched.

Dates are parsed from their `YYYY-MM-DD` parts into a *local* midnight, never via `new Date("2026-03-03")` — that form parses as UTC and reads as the previous day anywhere west of Greenwich, which would mark tasks overdue a day early. Day arithmetic snaps both sides to local midnight and rounds, so 23- and 25-hour DST days still count as exactly one day.

### Sorting vs. manual drag order

Drag-to-reorder writes a real position into the stored array. Sorting is only a **view** over that array — `sortTodos()` returns the list untouched for `manual` and a sorted copy otherwise, and the stored order is never rewritten by a sort. That's why drag is disabled whenever a filter or sort is active (`triaging` in `TodoPanel.jsx`), exactly as it already was during a search: the visible index doesn't map back to a stored position, so a drop would move the wrong row.

### The badge has to follow the dock edge

Anything drawn on the collapsed bubble competes with the peek: at rest only a ~22px sliver of the 72px bubble is on-screen, and **which** sliver depends on the dock edge (docked right → the left sliver survives, docked top → the bottom sliver, and so on). A decoration pinned to a fixed corner is therefore visible for only some dock edges. The pending-count badge originally hit exactly this — pinned top-right, it was clipped away entirely whenever the bubble docked right (the default) or top.

So `main.js` pushes the current edge to the renderer (`bubble:dock-edge` event + `bubble:get-dock-edge` handle, sent from `notifyDockEdge()` — called from `settleBubbleAtDock()` and on `ready-to-show`), `App.jsx` keeps it in state, and the badge gets a `bubble-badge--dock-<edge>` modifier class that positions it against the *opposite* side. The insets are small positive values rather than the negative "overhang" a fully-visible bubble could afford, so the whole badge fits inside that narrow sliver.

**If you add anything else to the collapsed bubble** — a second indicator, a progress ring, a hover affordance — it needs the same treatment. Check it against all four dock edges, not just the one you happen to be testing on.

### Why custom pointer-drag instead of CSS `-webkit-app-region: drag`

The original (phase 1) implementation used `-webkit-app-region: drag` on the bubble. That was replaced because it can't distinguish a plain click from a drag — it swallows both, which broke the "click bubble to open panel" interaction entirely once it shipped. The fix (`App.jsx`'s `handleBubblePointerDown/Move/Up`) tracks the pointer manually: only once cumulative movement exceeds `DRAG_THRESHOLD` (4px) does it start sending `bubble:drag-*` IPC events; a pointer-up before that threshold is treated as a click and calls `toggleExpand(true)` instead.

### Why CommonJS in `electron/`, not ESM

`package.json` has no `"type": "module"`. `electron/main.js` and `electron/preload.cjs` use `require`/`module.exports`. This is deliberate: Electron's preload-script loader has historically been finicky about ESM, and `electron-store` v9+ is pure ESM, which would break a plain `require("electron-store")` from a CommonJS main process. `electron-store` is pinned to `^8.2.0` (last CJS-compatible major) in `package.json` for this reason. `vite.config.js` and `src/` are unaffected — Vite bundles those independently of the root package's module type. The `landing/` app is its own separate npm package and has its own module-type concerns, unrelated to this one.

### Why `electron-store` over a database

Single-user local app, a handful of small records (todos, a dock position, a boolean). A JSON-file-backed key/value store is the entire persistence requirement.

### The IPC surface (`electron/preload.cjs`)

Everything the renderer can reach lives on `window.fx`, explicitly whitelisted — never widen this to exposing `ipcRenderer` directly:
- **Bubble/window:** `toggleExpand`, `getExpanded`, `onExpandedState` (push event — fired on every expand/collapse), `dragBubbleStart/Move/End` (fire-and-forget `ipcRenderer.send`, not `invoke` — there's no response needed mid-drag). Note: the panel does **not** auto-collapse on window blur/losing focus — it closes only when the panel's own ✕ button (`onClose` in `TodoPanel.jsx` → `toggleExpand(false)`) is clicked. An earlier version auto-collapsed on blur; that was removed because it closed the panel out from under the user mid-edit any time another window got focus.
- **Todos:** `getTodos`, `addTodo`, `toggleTodo`, `deleteTodo`, `editTodo`, `patchTodo` (PR number / blocked / feedback), `clearCompleted`, `completeMany`, `deleteMany`, `reorderTodos` — all request/response (`invoke`/`handle`), each mutating the in-memory `todos` array in `main.js`, persisting it, and returning the full updated array as the new source of truth for the renderer.
- **Clipboard:** `copyToClipboard`, used only by the login/logout report's copy button.

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` throughout.

## Project structure

```
floating-todo-tracker/
├── CLAUDE.md                   # this file
├── ROADMAP.md                  # PM feature roadmap: persona, prioritised backlog, non-goals
├── PLAN.md                     # the ORIGINAL phased plan (phases 0-5 only — see
│                                 # "What has been built" above for what came after)
├── RELEASING.md                # the main -> test -> release branch/CI workflow
├── README.md                   # human-facing overview: features, dev, packaging, releasing
├── LICENSE                     # MIT
├── package.json                # scripts, deps, electron-builder "build" config (win/linux only)
├── package-lock.json
├── vite.config.js              # Vite config for the renderer (React, port 5173)
├── eslint.config.mjs           # flat ESLint config — JSX + react/jsx-uses-vars,
│                                 # separate commonjs block for electron/**, ignores landing/ and docs/
├── index.html                  # renderer HTML shell — loads src/main.jsx
├── .gitignore
├── .github/
│   └── workflows/
│       ├── test.yml             # lint + build gate on main/test pushes and PRs into test/release
│       └── build.yml            # builds win/linux installers, publishes to GitHub Releases
├── build/
│   └── icon.png                 # placeholder app icon (generated, not real artwork)
├── electron/                     # the main process — CommonJS
│   ├── main.js                   # window creation, edge-docking/peek geometry, drag
│   │                              # tracking, IPC handlers, tray, Wayland warning
│   ├── preload.cjs                # contextBridge — the ONLY thing the renderer can call
│   │                              # into Node/Electron with
│   ├── store.js                   # electron-store instance + its schema/defaults
│   ├── tray-icon.png              # placeholder tray icons (generated)
│   └── tray-icon@2x.png
├── src/                            # the renderer — a React app, bundled by Vite
│   ├── main.jsx                    # ReactDOM root
│   ├── App.jsx                     # bubble <-> panel state, pointer-based drag/click detection
│   ├── styles.css                   # all styling — bubble, badge, panel, todo rows,
│   │                                # bulk-select bar, login/logout report view, scrollbars
│   ├── components/
│   │   ├── TodoPanel.jsx             # add/search input, list, bulk-select, report view
│   │   └── TodoItem.jsx               # checkbox, double-click-to-edit (text/PR#/blocked), delete
│   └── utils/
│       ├── focusTimer.js               # pomodoro phase cycle, remaining-time math, formatting
│       ├── logoutReport.js            # builds the formatted login/logout status report text
│       └── taskMeta.js                 # priority + due-date logic: parsing, day math, sorts, filters
├── landing/                          # SEPARATE npm project: the marketing/download site
│   ├── package.json                   # its own deps — not part of the root app's build
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── icon-data.js                # inlined icon as a data URI (see commit history —
│       │                              # fixes a missing-favicon bug caused by a fetched file)
│       ├── hooks/
│       │   ├── useLatestRelease.js      # reads the newest GitHub Release via the API
│       │   └── useOS.js                 # detects visitor OS to highlight the right download
│       └── components/
│           ├── Hero.jsx, Navbar.jsx, Footer.jsx
│           ├── Features.jsx, Compare.jsx, Platforms.jsx
│           ├── AppDemo.jsx               # the interactive in-browser demo of the app
│           └── ProductTour.jsx           # guided coachmark-style tour
└── docs/                              # GitHub Pages fallback — a static build OUTPUT of
    ├── index.html                      # landing/ (via `npm run build` there). Don't hand-edit;
    └── assets/                         # regenerate from landing/ instead.
```

### File-by-file notes

- **`electron/main.js`** is the only file that touches window geometry, docking, the tray, or `electron-store` directly. Changing *how the app behaves as an OS-level window* — always-on-top level, peek behavior, drag tracking, panel size — happens here.
- **`electron/preload.cjs`** should stay a thin, explicit whitelist.
- **`electron/store.js`** defines the *only* schema for what's persisted (`todos`, `nextTodoId`, `dock`, `expanded`). Add a new persisted field here first.
- **`src/App.jsx`** holds no todo logic itself — it mirrors `expanded`/`todos` from the main process and forwards user actions back over IPC, plus owns the click-vs-drag pointer tracking for the bubble.
- **`src/utils/logoutReport.js`** is pure string-building logic with no IPC/DOM dependency — easy to reason about and test in isolation if a test suite is ever added.
- **`landing/`** is a fully independent app (own `package.json`, own `node_modules`, own Vite build) that happens to live in this repo for convenience. It is never imported by or bundled into the actual Electron app — treat it as a separate deployable.
- **`docs/`** is a *build output*, not source — it's what `landing/`'s `npm run build` emits, kept committed so GitHub Pages can serve it as a fallback to the Vercel deployment. Regenerate it from `landing/`, don't hand-edit files inside it.
- **Icons (`build/icon.png`, `electron/tray-icon*.png`)** are still programmatically generated placeholder circles, not real artwork. `landing/public/icon.png` may or may not be the same placeholder — check before assuming it's final brand art.

## Known limitations

- **Edge-dock/peek behavior unverified in this session's context** — it was built by whichever session added it and should be treated as real, shipped behavior, but if you're debugging a report about docking/peeking looking wrong on a specific OS, remember multi-monitor and per-OS window-manager quirks are exactly the kind of thing that's hard to fully verify without physically testing on that OS.
- **No undo / no export.** Deleting a todo (individually or via bulk-delete), clearing completed, or losing the `electron-store` JSON file loses that data permanently — no backup, trash, or export/import.
- **No code signing.** Windows builds are unsigned, so they'll trigger a SmartScreen warning on first run. macOS is no longer a target at all, so this doesn't apply there.
- **Wayland**: `alwaysOnTop` has no equivalent in the native Wayland protocol (as opposed to XWayland), so under native Wayland the bubble can end up covered by other windows — a logged Electron/Wayland limitation (`warnIfUnsupportedWayland` in `main.js`), not a bug to try to fix here.
- **AppImage sandbox**: AppImage extracts to a FUSE mount at runtime, which strips the SUID bit Chromium's sandbox helper needs — if the packaged AppImage refuses to start with a sandbox error, that's expected; launch with `--no-sandbox` or use the `.deb` build instead.
- **Placeholder icons everywhere**, as noted above.

## Git / release workflow

This is **not** a simple "commit straight to main" project anymore — see `RELEASING.md` for the authoritative full workflow. Summary:

```
main --(PR)--> test --(CI: lint + build)--> release --(CI: build + publish)--> GitHub Release
```

- Day-to-day development happens on `main`; every push there runs the `Test` workflow (lint + renderer build).
- Promoting to `test` (merge `main` into it) re-runs that same gate — a cheap check before anything is packaged.
- Promoting to `release` (merge `test` into it) triggers `build.yml`: builds Windows/Linux installers and publishes/updates a rolling `continuous` pre-release on GitHub.
- A real versioned release is a `v*` tag pushed from `release` (`npm version patch/minor/major`, then `git push origin release --follow-tags`) — this publishes a permanent, named GitHub Release instead of overwriting the rolling one.

**On working with more than one session on this repo**: given the history of two independent Claude Code sessions building on this repo in parallel (see "Project purpose" above), always `git fetch` and check `origin/main` against local `HEAD` before assuming your local checkout is current, and prefer a rebase-and-resolve over a force-push when they've diverged — the other session's work is as legitimate as your own and should never be silently discarded.
