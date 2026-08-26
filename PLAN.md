# Plan

A small circular bubble that stays on top of every window, on every virtual
desktop, wherever you put it. Click it and it opens into a todo list right
next to where it's sitting. Click away and it collapses back to just the
bubble. Fully local — no account, no server, no sync.

## Stack

- **Electron** — the only mainstream way to get a frameless, always-on-top,
  visible-on-all-workspaces window with real drag/reposition behavior,
  consistently across Windows, macOS and Linux.
- **React + Vite** for the UI inside that window.
- **electron-store** for local JSON persistence (todos, window position,
  expanded/collapsed state) — no database needed for a single-user local app.
- **electron-builder** for producing installers (nsis/dmg/AppImage).

One window, not two: the bubble and the panel are the same BrowserWindow.
Expanding is a resize (small square → wide panel), not opening a second
window — simpler to keep anchored to wherever the user dragged the bubble,
and there's nothing to keep in sync between two windows.

## Phases

- **Phase 0 — Scaffold.** package.json, Vite config, gitignore, placeholder
  icons, this plan, README with dev instructions.
- **Phase 1 — The floating bubble.** Frameless, transparent,
  `alwaysOnTop('screen-saver')`, `setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true })`, `skipTaskbar: true`, draggable via
  `-webkit-app-region: drag`. A preload script exposes a minimal IPC bridge
  (contextIsolation on, nodeIntegration off).
- **Phase 2 — Expand/collapse todo panel.** React UI: bubble face when
  collapsed; add/complete/delete/reorder list when expanded. Expanding
  resizes+repositions the window so it grows from the bubble's corner and
  stays on-screen; clicking outside (window blur) collapses it back.
- **Phase 3 — Persistence.** Todos, window position, and expanded/collapsed
  state saved via `electron-store`, restored on next launch so the bubble
  reopens exactly where — and how — you left it.
- **Phase 4 — Tray icon.** Show/hide the bubble, "Launch at login" toggle
  (`app.setLoginItemSettings`), Quit. A safety net for re-summoning the
  bubble if it's ever dragged off-screen or hidden.
- **Phase 5 — Packaging.** `electron-builder` targets for Windows (nsis),
  macOS (dmg), Linux (AppImage) — since all three platforms were wanted.

## Deliberately out of scope for v1

- Cloud sync / accounts — this is a local single-machine tool.
- Due dates, reminders, notifications — real feature, but v2; adds a
  scheduling surface that isn't needed to prove the core interaction
  (floating bubble → expand → manage todos → collapse).
- Global keyboard shortcut to summon the bubble — nice-to-have, not needed
  once the tray icon exists as a fallback.
- Custom app icon artwork — the icons committed now are placeholder
  generated circles so packaging works end-to-end; swap `build/icon.png`
  and `electron/tray-icon*.png` for real artwork before shipping installers
  to anyone else.

## Known limitation of this environment

This was built and pushed from a headless remote session with no display —
the actual floating/dragging/always-on-top behavior can only be verified by
running it on a real desktop (`npm install && npm run dev`). Treat the first
local run as the real acceptance test for phases 1–2.
