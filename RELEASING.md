# Releasing

Three branches, three jobs:

```
main     ── everyday development
test     ── integration gate before a release goes out
release  ── pushing here builds and publishes installers automatically
```

```
main --(PR)--> test --(CI: lint + build)--> release --(CI: build + publish)--> GitHub Release
```

## 1. Develop on `main`

Normal work happens here. Every push to `main` also runs the `Test`
workflow (lint + renderer build) so breakage is caught immediately, not
just when you try to release.

## 2. Promote to `test`

```bash
git checkout test
git merge main
git push
```

This re-runs the same lint + build gate
(`.github/workflows/test.yml`). Opening a PR into `test` or `release`
runs it too, so you can require it to pass before merging in GitHub's
branch protection settings. Nothing is packaged or published at this
stage — it's a cheap, fast check.

## 3. Promote to `release` → get installers automatically

```bash
git checkout release
git merge test
git push
```

Pushing to `release` triggers `.github/workflows/build.yml`, which:

1. **Bumps the version automatically.** A `version` job bumps
   `package.json`'s patch version (`npm version patch`), commits that
   with `chore(release): vX.Y.Z [skip ci]`, and pushes the commit plus
   the matching `vX.Y.Z` tag back to `release`. The `[skip ci]` stops
   that push from re-triggering the workflow — the `build` job below
   already picks up the new tag directly, so there's no second run.
2. **Builds the Windows (`.exe`) and Linux (`.AppImage` + `.deb`)**
   installers, at that bumped version, on their respective native
   runners (`windows-latest` / `ubuntu-latest`).
3. **Publishes a real, permanent GitHub Release** named after the new
   tag (e.g. `v0.2.0`) — not a rolling pre-release. Every push to
   `release` now becomes its own numbered version automatically; there
   is no more disposable `continuous` channel.

So step 3 above (`git push`) is the entire release process for the
common case — a new patch version and installers show up within a few
minutes with no extra command.

## 4. Cut a minor/major release instead of a patch

The auto-bump on every push is always a **patch**. For a minor or
major bump, do it yourself before pushing — the workflow only takes
over if it doesn't find one of its own bump commits at the tip:

```bash
git checkout release
npm version minor   # or: major — bumps package.json + commits + tags
git push origin release --follow-tags
```

Pushing a `v*` tag directly (as this does) skips the auto-bump `version`
job entirely and goes straight to building + publishing that exact
tag as the release.

## Where builds come from, per OS

| OS | Installer | Built on | Command |
|---|---|---|---|
| Windows | `.exe` (nsis) | `windows-latest` | `npm run dist:win` |
| Linux | `.AppImage`, `.deb` | `ubuntu-latest` | `npm run dist:linux` |

You can run either of these locally too, but a Windows build only
produces a *usable*, unblocked installer when run on Windows (or its CI
runner) — cross-building it elsewhere is possible with electron-builder
but not worth the extra setup here.

macOS is not a supported target for this project — no `.dmg` is built,
and there's no code signing/notarization to configure. There is also no
iOS build: Electron ships desktop apps (Windows/Linux here) only;
packaging this as a mobile app would mean a different toolchain
entirely (e.g. rewriting it in/with React Native or Capacitor), not an
electron-builder target.

## Branch protection (recommended, one-time GitHub setting)

In *Settings → Branches*, add a ruleset for `test` and `release`
requiring the `Test` workflow's `lint-and-build` job to pass before
merging. This keeps a broken `main` from ever reaching `release` and
triggering a public build.
