# Floating Todo Tracker

A small always-on-top bubble that floats over every window and every virtual
desktop. Click it to open a todo list anchored right there; click away and it
collapses back to just the bubble. Local-only — no account, no server.

See [`PLAN.md`](./PLAN.md) for the phased build plan and design decisions.

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
npm run dist:linux   # Linux (AppImage)
```

The icons in `build/icon.png` and `electron/tray-icon*.png` are
placeholders — replace them with real artwork before distributing a build to
anyone else.

## Project layout

```
electron/
  main.js       # window creation, tray, IPC handlers
  preload.js    # contextBridge — the only surface the renderer can call
  store.js      # electron-store wrapper (todos, window position/state)
src/
  main.jsx      # React entry point
  App.jsx       # bubble <-> panel state
  components/   # BubbleFace, TodoPanel, TodoItem
```
