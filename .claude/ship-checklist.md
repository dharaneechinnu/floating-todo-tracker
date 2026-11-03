# Ship checklist — FocusDock overrides

Read by the `ship-checklist` plugin (`claude-plugins/plugins/ship-checklist`). See `RELEASING.md` for the full workflow.

## Branches and environments
- Development: `main` (each push runs `test.yml`: lint and build)
- Staging / test: `test` (merge `main` into it; the same gate runs again)
- Production: `release` (merge `test` into it; `build.yml` bumps the patch version, builds the installers and publishes a GitHub Release)
- Minor/major release: `npm version minor|major` on `release`, then `git push origin release --follow-tags`

## Commands
- Lint: `npm run lint`
- Build: `npm run build`
- Test: **there is no test suite**. Mark automated tests ⏭ N/A and require the manual checks below instead.
- Dependency audit: `npm audit --omit=dev`
- Landing site build (only if `landing/` changed): `cd landing && npm run build`. This emits `docs/`, which must be committed.

## Target platforms
- Windows (`.exe`, nsis): unsigned, so a SmartScreen warning is expected
- Linux (`.AppImage` and `.deb`)
- macOS: not a target

## Extra items (manual, via `npm run dev`)
- [ ] The bubble stays on top of other windows, and on every virtual desktop
- [ ] Drag to each of the 4 edges: it docks and peeks about 30%; the pending badge is visible on every edge
- [ ] Click opens the panel; ✕ closes it; it doesn't close on blur
- [ ] Todos, dock position and the focus-timer state survive a restart (`userData` stays pinned to the legacy `Floating Todo Tracker` folder)
- [ ] Store schema changes in `electron/store.js` have defaults for existing users
- [ ] Priority and due-date rule changes are mirrored in `src/utils/taskMeta.js` **and** `electron/main.js`
- [ ] No widening of the `window.fx` IPC surface beyond an explicit whitelist

## N/A by default
- Feature flags: N/A, there are none
- Server monitoring: N/A, fully local with no telemetry. Post-release means watching GitHub issues instead.
- Privacy: N/A unless the change adds any network call
