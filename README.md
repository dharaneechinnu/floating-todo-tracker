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

## Features

- **Floating, always-on-top bubble** — frameless, transparent, visible on
  every virtual desktop/workspace, unaffected by other windows.
- **Edge docking with peek** — drag the bubble anywhere; on release it snaps
  to whichever screen edge it's closest to and rests there showing only
  ~30% of itself, the rest clipped naturally by the display boundary.
  Multi-monitor aware — it won't peek toward a neighboring display.
- **Click to open, click away to close** — the same window resizes in place
  into a todo panel anchored to the docked edge, and collapses back when it
  loses focus.
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
npm run dist:mac     # macOS (dmg)
npm run dist:linux   # Linux (AppImage + deb)
```

The icons in `build/icon.png` and `electron/tray-icon*.png` are
placeholders — replace them with real artwork before distributing a build to
anyone else.

### macOS: signing & notarization

Gatekeeper blocks any unsigned, unnotarized app distributed outside the App
Store. The mac build is already configured for hardened runtime
(`build/entitlements.mac.plist`) and notarization (`scripts/notarize.js`),
but both need real credentials to do anything — without them the build
still succeeds, just unsigned. Set these before running `dist:mac` for a
real release:

```bash
CSC_LINK=<path or URL to your Developer ID .p12>
CSC_KEY_PASSWORD=<its password>
APPLE_ID=<your Apple ID email>
APPLE_APP_SPECIFIC_PASSWORD=<app-specific password, not your Apple ID password>
APPLE_TEAM_ID=<your Apple Developer team ID>
```

The GitHub Actions workflow reads the same five values from repo secrets
(`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`,
`APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) if you want CI to produce
signed releases.

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

Push a tag like `v0.1.0` and the `Build installers` GitHub Actions workflow
builds the Windows/macOS/Linux installers and publishes them as assets on a
GitHub Release for that tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Download page

`docs/index.html` is a static landing page (served via GitHub Pages from the
`docs/` folder) with download buttons for Windows, macOS, and Linux. It reads
the latest GitHub Release via the GitHub API at load time, so it always links
to the newest installers with no manual updates needed after each release.

## Project layout

```
electron/
  main.js                    # window creation, edge docking, tray, IPC handlers
  preload.cjs                # contextBridge — the only surface the renderer can call
  store.js                   # electron-store wrapper (todos, dock position, expanded state)
build/
  entitlements.mac.plist     # macOS hardened-runtime entitlements
scripts/
  notarize.js                # electron-builder afterSign hook (macOS notarization)
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
which OS you tested on — Windows, macOS, and Linux behave differently
enough here (see the platform notes above) that "works on my machine" needs
the machine named.

## License

[MIT](./LICENSE)
