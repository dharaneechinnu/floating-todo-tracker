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

1. Builds the Windows (`.exe`) and Linux (`.AppImage` + `.deb`)
   installers on their respective native runners (`windows-latest` /
   `ubuntu-latest`), which the workflow's matrix already provides.
2. Publishes (or updates, if it already exists) a GitHub Release tagged
   **`continuous`**, marked as a pre-release, with the fresh installers
   attached. Every subsequent push to `release` overwrites that same
   release with new builds — it's a rolling "latest from `release`"
   channel, not a version history.

Use this to hand someone a build to try without cutting a real version
number.

## 4. Cut an official versioned release

A `continuous` pre-release is disposable; a real release is a tag. Do
this from `release` once it's been verified:

```bash
git checkout release
npm version patch   # or: minor / major — bumps package.json + commits + tags
git push origin release --follow-tags
```

Pushing a `v*` tag runs the exact same `build.yml` workflow, but this
time it publishes a proper, permanent GitHub Release named after the
tag (e.g. `v0.2.0`), not the rolling `continuous` one. This is the
release your [download page](./docs/index.html) and users should
point to.

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
