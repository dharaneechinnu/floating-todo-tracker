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
  main.js       # window creation, tray, IPC handlers
  preload.js    # contextBridge — the only surface the renderer can call
  store.js      # electron-store wrapper (todos, window position/state)
src/
  main.jsx      # React entry point
  App.jsx       # bubble <-> panel state
  components/   # BubbleFace, TodoPanel, TodoItem
```
