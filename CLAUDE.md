# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

A small, personal desktop tool: a circular bubble that floats **always on top of every window, on every virtual desktop**, wherever you drag it — click it and it opens into a todo list anchored right there; click away and it collapses back to just the bubble. Think of it as a "chat head" (the kind Facebook Messenger popularized on mobile) but for a todo list, on a desktop, running locally with no account and no server.

It exists because the owner wanted their todo list to be **physically inescapable** — not a tab you forget to open, not an app you have to alt-tab to, but a small persistent object sitting on top of whatever you're doing. The product is the always-visible bubble; the todo list is what's inside it.

This is a **single-user, local-only, personal-use app** — not a product being shipped to other people (yet). That shapes several decisions below: no accounts, no cloud sync, no telemetry, no code signing, placeholder icons. All deliberate, not oversights — see "Deliberately out of scope" in `PLAN.md`.

This repo is intentionally separate from `dharaneechinnu/reddyfox` (a Django/React web business site) — this is a desktop app with a completely different runtime (Electron/Node, no backend, no database), so it has nothing to share with that project beyond both being personal work.

## What has been built so far

Everything below is done, committed, and pushed to `main` — one commit per phase, per the plan in `PLAN.md`:

- **Phase 0 — scaffold.** `package.json` with all scripts and dependencies, Vite config, `.gitignore`, placeholder icons (generated programmatically, see below), `PLAN.md`, `README.md`.
- **Phase 1 — the floating bubble window.** `electron/main.js` creates a frameless, transparent, always-on-top `BrowserWindow` that stays visible across every virtual desktop/Space, is draggable, and toggles between a 72×72 circle and a 300×400 panel via IPC. `electron/preload.cjs` exposes a minimal, safe bridge to the renderer.
- **Phase 2 — the todo panel UI.** `src/components/TodoPanel.jsx` and `TodoItem.jsx`: add a todo, check it off, delete it, drag to reorder. Wired to IPC handlers in `main.js` that were in-memory at this point.
- **Phase 3 — persistence.** `electron/store.js` wraps `electron-store` (a JSON-file-backed key/value store). Todos, the bubble's last position, and whether it was left expanded or collapsed are all saved and restored across restarts.
- **Phase 4 — system tray.** A tray icon with "Show/Hide bubble," a "Launch at login" checkbox (backed by `app.setLoginItemSettings`), and "Quit." Exists mainly as a safety net — if the bubble ever gets dragged off-screen or hidden, the tray is how you get it back.
- **Phase 5 — packaging.** `electron-builder` config in `package.json` for Windows (nsis `.exe`), macOS (`.dmg`), and Linux (AppImage), plus a GitHub Actions workflow (`.github/workflows/build.yml`) that builds all three on a version tag push or manual trigger.

**Not yet done / not built:** the app has not been run and visually verified — it was built and pushed from a headless remote session with no display, so `npm install && npm run dev` on a real machine is the actual first test of phases 1–2's window behavior (see "Known limitations" below). Everything was syntax-checked (`node --check` on the CommonJS files, `JSON.parse` on `package.json`) but never executed.

A separate, standalone **interactive browser preview** of the UI (not part of this repo) was also published as a Claude Artifact during development — it ports the exact same CSS and add/toggle/delete/reorder logic into a static page so the UI could be reviewed without a desktop build. It has no connection to this codebase at runtime (it's a one-off demo page, not a build target) and is not something to keep in sync going forward.

## Commands

```bash
npm install
npm run dev              # Vite dev server + Electron, both together
npm run build             # production Vite bundle only
npm run dist:win          # build + package a Windows installer (nsis)
npm run dist:mac          # build + package a macOS installer (dmg)
npm run dist:linux        # build + package a Linux installer (AppImage)
npm run lint               # eslint (flat config, eslint.config.mjs)
```

There is no test suite. Verifying a change means running `npm run dev` and actually dragging/clicking the bubble — this is a UI-and-OS-interaction-heavy app where the correctness that matters (does it really stay on top? does dragging feel right? does it survive a restart?) can't be checked by reading code.

## Architecture

```
Electron main process (electron/main.js)
  │
  ├─ owns the one BrowserWindow — the bubble AND the panel are the
  │  same window, just resized between two fixed sizes
  ├─ owns the Tray icon
  ├─ owns electron-store (electron/store.js) — the only place data is
  │  read or written
  │
  ├─ IPC (via electron/preload.cjs, contextBridge, contextIsolation on)
  │
  React renderer (src/)
    │
    ├─ src/App.jsx — top-level: bubble vs panel, based on `expanded`
    │  state pushed from main
    └─ src/components/{TodoPanel,TodoItem}.jsx — the list UI
```

### Why one window, not two

The bubble and the expanded panel are the *same* `BrowserWindow`, just resized (72×72 ↔ 300×400) and repositioned to grow from whichever screen edge the bubble is nearest. This was a deliberate simplification over "a small bubble window + a separate panel window": one window means there's only one set of bounds to keep on-screen, nothing to keep in sync between two windows, and no window-manager quirks around two always-on-top windows overlapping. The trade-off is a resize animation instead of a second window sliding in — considered the better trade for a single-user tool.

### Why CommonJS in `electron/`, not ESM

`package.json` deliberately has **no** `"type": "module"`. `electron/main.js` and `electron/preload.cjs` use `require`/`module.exports`. This was a specific decision, not a default: Electron's preload-script loader has historically been finicky about ESM (`require is not defined` / `ERR_REQUIRE_ESM` failures depending on Electron version and `contextIsolation` settings), and `electron-store` v9+ moved to **pure ESM**, which would break a straightforward `require("electron-store")` from a CommonJS main process. Rather than fight either of those, the whole `electron/` folder stays CommonJS and `electron-store` is pinned to `^8.2.0` (last CJS-compatible major version) in `package.json`. `vite.config.js` and the `src/` React files are unaffected — Vite bundles those independently of the root package's module type.

### Why `electron-store` over a database

This is a single-user local app with a handful of small records (a todo list, a window position, a boolean). A JSON-file-backed key/value store is the entire persistence requirement — anything more (SQLite, a real database) would be solving a problem this app doesn't have.

### The expand/collapse anchoring logic

`setExpanded()` in `main.js` doesn't just resize the window — it decides whether to grow the panel to the left or right of the bubble's current position, based on which half of the display the bubble's center is on (`anchorRight` in the code), then clamps the result to the display's work area (`clampToDisplay`). This is what stops the panel from being rendered partly off-screen when the bubble is parked near a screen edge, which is the normal case since the default position is bottom-right.

### The two IPC surfaces

`electron/preload.cjs` exposes exactly two families of calls on `window.fx`, both `ipcRenderer.invoke`/`ipcMain.handle` (request/response, not fire-and-forget):
- **Bubble state:** `toggleExpand(next)`, `getExpanded()`, and the `onExpandedState` push event (fired whenever the main process changes `expanded`, including the blur-triggered auto-collapse — so the renderer never has to guess the window's size, it's always told).
- **Todos:** `getTodos`, `addTodo`, `toggleTodo`, `deleteTodo`, `reorderTodos` — each handler mutates the in-memory `todos` array in `main.js`, persists it via `store.set("todos", todos)`, and returns the full updated array, which the renderer uses to replace its local state. There's no separate "success" vs. "data" shape — the return value *is* the new source of truth, kept deliberately simple since there's only ever one renderer talking to one main process.

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` throughout — the renderer has no access to Node or Electron APIs except through the whitelisted `window.fx` surface.

## Project structure

```
floating-todo-tracker/
├── CLAUDE.md                   # this file
├── PLAN.md                     # the phased build plan and the reasoning behind it
├── README.md                   # human-facing quickstart (install, dev, build)
├── package.json                # scripts, deps, and the electron-builder "build" config
├── vite.config.js              # Vite config for the renderer (React, port 5173)
├── eslint.config.mjs           # flat ESLint config (JSX-aware, .cjs-aware for electron/)
├── index.html                  # renderer HTML shell — loads src/main.jsx
├── .gitignore                  # node_modules, dist/, dist-electron/, release/, .env
├── .github/
│   └── workflows/
│       └── build.yml           # CI: builds win/mac/linux installers on a version tag
├── build/
│   └── icon.png                # 512×512 placeholder app icon (generated, see below)
└── electron/                    # the main process — everything here is CommonJS
    ├── main.js                  # window creation, IPC handlers, tray, all app logic
    ├── preload.cjs               # contextBridge — the ONLY thing the renderer can call into Node/Electron with
    ├── store.js                  # electron-store instance + its schema/defaults
    ├── tray-icon.png             # 32×32 tray icon (generated placeholder)
    └── tray-icon@2x.png          # 64×64 retina tray icon (generated placeholder)
└── src/                          # the renderer — a small React app, bundled by Vite
    ├── main.jsx                  # ReactDOM root
    ├── App.jsx                   # top-level: shows <bubble> or <TodoPanel> based on expanded state
    ├── styles.css                 # all styling — the bubble, the panel, the todo rows
    └── components/
        ├── TodoPanel.jsx           # the expanded view: header, add-input, the list, drag-reorder logic
        └── TodoItem.jsx             # one row: checkbox, text, delete button
```

### File-by-file notes

- **`electron/main.js`** is the only file that touches window geometry, the tray, or `electron-store` directly. If you're changing anything about *how the app behaves as an OS-level window* (always-on-top level, workspace visibility, drag behavior, panel size), this is the file.
- **`electron/preload.cjs`** should stay a thin, explicit whitelist. Never widen it to `contextBridge.exposeInMainWorld("fx", ipcRenderer)` or similar — every IPC channel the renderer can reach should be named here individually.
- **`electron/store.js`** defines the *only* schema for what's persisted. Adding a new persisted field means adding it to the `defaults` object here first.
- **`src/App.jsx`** holds no todo logic itself — it only tracks `expanded` and `todos` as local state mirrors of what `main.js` reports, and forwards user actions back over IPC. The actual todo mutations happen in `main.js`; the renderer never mutates its own `todos` state as the source of truth except optimistically during drag-reorder (see `TodoPanel.jsx`'s `handleDragOver`), which is then confirmed by the IPC round-trip.
- **`src/styles.css`** is the one and only stylesheet — no CSS modules, no styled-components, no Tailwind. Given the small, fixed set of UI states (bubble, panel, todo row × done/not-done), a plain stylesheet was simpler than adding a styling dependency.
- **Icons (`build/icon.png`, `electron/tray-icon*.png`)** are programmatically generated flat orange circles (via a small pure-Python PNG encoder, not committed — it was a throwaway build step), not real artwork. They exist so `electron-builder` has something to package and the tray has something to show. **Replace these before this app is ever shared with anyone else** — see `PLAN.md`'s "Deliberately out of scope" section.

## Known limitations

- **Never run/visually verified.** Built in a headless remote session with no display. The window-manager-level behavior (always-on-top actually staying on top over a fullscreen app, visibility across virtual desktops/Spaces, drag feel) is unverified until someone runs `npm run dev` on a real machine. Treat the first local run as the real acceptance test, not this document.
- **No undo / no export.** Deleting a todo, or losing the `electron-store` JSON file (uninstall, manual deletion, corruption), loses that data permanently — there's no backup, trash, or export/import. Acceptable for a v1 personal tool; would need addressing before this became something to rely on for anything important.
- **No code signing.** Windows/macOS builds from `npm run dist:*` are unsigned, so they'll trigger a SmartScreen/Gatekeeper warning on first run. Fine for personal use on your own machine; would need a signing certificate before distributing to anyone else.
- **Placeholder icons everywhere**, as noted above.

## Git workflow

Solo project, direct commits to `main` — no branch-per-feature, no PR review process (there's no team). Commits were made **one per plan phase** (`phase 0: ...` through `phase 5: ...`) specifically so the history reads as a build log; keep that pattern for any future phased work, but day-to-day fixes and small features don't need to force-fit a "phase" label.
