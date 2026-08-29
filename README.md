# Floating Todo Tracker

[![Build installers](https://github.com/dharaneechinnu/floating-todo-tracker/actions/workflows/build.yml/badge.svg)](https://github.com/dharaneechinnu/floating-todo-tracker/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Electron](https://img.shields.io/badge/Electron-32-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)

A small always-on-top bubble that floats over every window and every virtual
desktop. Drag it to any edge of the screen and it docks there, peeking out
just enough to stay reachable. Click it to open a todo list anchored right
there; click away and it collapses back to just the bubble. Fully local — no
account, no server, no telemetry.

See [`PLAN.md`](./PLAN.md) for the original phased build plan and design
decisions.

**[floating-todo-tracker.vercel.app](https://floating-todo-tracker.vercel.app)**
— live landing page with a guided product tour and download links for
Windows and Linux.

## Features

- **Floating, always-on-top bubble** — frameless, transparent, visible on
  every virtual desktop/workspace, unaffected by other windows.
- **Edge docking with peek** — drag the bubble anywhere; on release it snaps
  to whichever screen edge it's closest to and rests there showing only
  ~30% of itself, the rest clipped naturally by the display boundary.
  Multi-monitor aware — it won't peek toward a neighboring display.
- **Click to open, ✕ button to close** — the same window resizes in place
  into a todo panel anchored to the docked edge. It only collapses back when
  you click the close button in its header — losing focus (clicking another
  app, alt-tabbing) leaves it open, so it won't vanish mid-edit.
- **Draggable tracker sheet** — the open panel can be dragged by its header
  to a new position; closing it re-docks from wherever it ended up.
- **One input, add or search** — type to filter the list live; press Enter
  to add it as a new todo only if nothing matching already exists, so you
  can't create near-duplicates by accident.
- **Double-click to rename** — edit any todo's text in place, `Enter` to
  save, `Esc` to cancel.
- **Drag-to-reorder** — reorder the list by dragging rows (disabled while a
  search filter is active, since the visible order isn't the full list).
- **Custom themed scrollbar** on the todo list instead of the OS default.
- **Persisted locally** via `electron-store` — todos, dock position, and
  expanded/collapsed state all survive a restart.
- **Tray icon** — show/hide the bubble, toggle "Launch at login", quit.

## Requirements

- Node.js 18+
- npm

## Develop

```bash
npm install
npm run dev
```

This starts the Vite dev server and launches Electron pointed at it. The
bubble should appear near the bottom-right of your primary display the first
time you run it.

## Build a production bundle

```bash
npm run build
```

## Package an installer

```bash
npm run dist:win     # Windows (nsis)
npm run dist:linux   # Linux (AppImage + deb)
```

The icons in `build/icon.png` and `electron/tray-icon*.png` are
placeholders — replace them with real artwork before distributing a build to
anyone else.

### Linux: sandbox on AppImage

AppImage extracts to a FUSE mount at runtime, which strips the SUID bit
Chromium's sandbox helper (`chrome-sandbox`) needs. If the packaged
AppImage refuses to start with a sandbox error, launch it with
`--no-sandbox`, or install the `.deb` build instead (also produced by
`dist:linux`), which doesn't hit this issue.

### Linux: Wayland

`alwaysOnTop` has no equivalent in the Wayland protocol, so on a native
Wayland session (not XWayland) the bubble can end up covered by other
windows — this is an Electron/Wayland limitation, not a bug in this app.
The app logs a warning to the console when it detects this at startup.

## Releasing installers

Quick version: push a tag like `v0.1.0` and the `Build installers` GitHub
Actions workflow builds the Windows/Linux installers and publishes them
as assets on a GitHub Release for that tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

There's also a `test` → `release` branch pipeline for staging a build
before cutting a real version, with a rolling pre-release published on
every push to `release`. See [`RELEASING.md`](./RELEASING.md) for the
full workflow.

## Download page

The `landing/` folder is a React (Vite) marketing/download site: a live
interactive mock of the app, a guided coachmark-style product tour, a
comparison section against typical todo apps, and download cards for
Windows and Linux that read the latest GitHub Release via the GitHub API
at load time — always pointing at the newest installers with no manual
updates needed.

It's deployed to **[floating-todo-tracker.vercel.app](https://floating-todo-tracker.vercel.app)**
(the repo's GitHub homepage link). `npm run build` inside `landing/` also
still emits a static copy into `docs/`, kept as a GitHub Pages fallback.

```bash
cd landing
npm install
npm run dev     # local dev server
npm run build   # production build -> ../docs
```

## Project layout

```
electron/
  main.js                    # window creation, edge docking, tray, IPC handlers
  preload.cjs                # contextBridge — the only surface the renderer can call
  store.js                   # electron-store wrapper (todos, dock position, expanded state)
src/
  main.jsx                   # React entry point
  App.jsx                    # bubble <-> panel state, pointer-based drag/click detection
  components/
    TodoPanel.jsx            # search-or-add input, todo list, reordering
    TodoItem.jsx             # checkbox, double-click-to-edit, delete
  styles.css                 # bubble, panel and custom scrollbar styling
docs/
  index.html                 # GitHub Pages download page
```

## Contributing

Issues and pull requests are welcome.

```bash
npm run lint    # ESLint over the whole repo
npm run dev     # manual smoke test — this is a desktop app, so most
                # behavior (drag/dock/peek, always-on-top, tray) can only
                # really be verified by running it
```

Keep changes scoped and run `npm run lint` before opening a PR. If you're
touching the window/docking logic in `electron/main.js`, please mention
which OS you tested on — Windows and Linux behave differently enough here
(see the platform notes above) that "works on my machine" needs the
machine named.

## License

[MIT](./LICENSE)
