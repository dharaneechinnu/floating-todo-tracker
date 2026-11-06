# Versioning and data migrations

FocusDock is moving from a local todo bubble to a product with an encrypted
vault and an optional synced account. Saved data must survive every upgrade.
This file is the rulebook for changing anything that gets persisted, and the
release plan that sequences the work.

## Six version numbers

Each one only ever goes up, and each one has a single job.

| Number | Lives in | Goes up when |
|---|---|---|
| App version | `package.json` (semver) | Every release: minor for features, patch for fixes |
| Local schema | `schemaVersion` in electron-store's `config.json` | Todos, dock or session data changes shape |
| Vault format | `format` in `vault.json` (from 0.3) | The vault file layout changes |
| Encryption version | `v` on every encrypted item and wrapped key (from 0.3) | Cipher or key-derivation settings change |
| API version | URL prefix `/v1/` on the server | A breaking change to a request or response |
| Server schema | `migrations` collection in MongoDB | Collections, indexes, validators or document shape change |

## Rules

- **R1 Migrate before anything reads.** `electron/store.js` runs the migration
  runner the moment the store is constructed, before `main.js` reads a single
  key. Feature code only ever sees the latest shape.
- **R2 Back up before migrating.** The file is copied to
  `backups/config.v{old}.{timestamp}.json` next to it (newest 5 kept). If a
  migration throws, the original data is used unchanged and nothing is written.
- **R3 Refuse to write newer data.** If the file's `schemaVersion` is higher
  than this build knows, the store goes read-only and the user is told to
  update. The same happens if a migration fails.
- **R4 Keep unknown fields.** Migrations and handlers spread the existing
  object (`{ ...todo, ...changes }`) so fields added by a newer version
  survive an older one editing the same record. This is what keeps two
  computers on different versions safe once sync exists.
- **R5 Expand, then contract.** Never rename or remove a field in one release.
  Add the new field, write both for one release, read only the new one in the
  next, remove the old one in a third.
- **R6 Server goes first.** Deploy server changes before the app release that
  needs them. Server migrations must keep working with the server version that
  is already running.
- **R7 Every migration has a fixture.** A sample file from each old version
  lives in `test/fixtures/store/`. `npm test` migrates every fixture to the
  latest schema and checks the result.
- **R8 New features ship behind a flag.** `electron/features.js` lists the
  switches; testers turn them on from the tray's **Beta features** menu.
  Flipping a switch's `default` makes it on for everyone without a new kind
  of build.

## Adding a local migration

1. Copy a sample of the *current* `config.json` shape into
   `test/fixtures/store/v{current}.json`.
2. Add `electron/migrations/store/00N-what-it-does.js` exporting
   `{ version: N, description, up(data) { ...; return data; } }`. `up` gets a
   deep copy, so it may mutate it.
3. Append it to `electron/migrations/store/index.js`. Never edit, reorder or
   delete a migration that has shipped.
4. Add assertions for the new shape to `test/migrations.test.mjs`, run
   `npm test`.

Never put `schemaVersion` in the electron-store `defaults`: electron-store
merges defaults into an existing file, which would stamp an old file as
current and skip every migration.

Known gap: electron-store writes missing default keys into the file when it is
constructed, before the runner checks the version. On a newer-version file
that only adds top-level keys this build knows; it never removes or changes
existing ones.

### Local schema history

| Version | Release | Change |
|---|---|---|
| 0 | ≤ 0.1 | Unversioned file |
| 1 | 0.2 | `schemaVersion` recorded; missing todo fields backfilled; `nextTodoId` repaired if it would reuse an id |
| 2 | 0.2 | Every todo gets a `uid` (UUID) for cross-device sync |

## Server migrations

See `server/README.md`. Steps live in `server/src/migrations/`, run in order
on boot (and with `npm run migrate`), and are recorded in the `migrations`
collection. A lock document stops two server instances migrating at once.

## Release plan

| Version | Theme | Data changes |
|---|---|---|
| 0.2 | Foundation: migration runner, backups, read-only guard, tests, server and database base, then auto-update, feature flags, todo export | Local schema 0 → 2; server schema 1 |
| 0.3 | Local vault behind a beta flag | Vault format 1, encryption v1 |
| 0.4 | Vault for everyone, encrypted backup file, change passphrase, optional app lock | Vault format 2 |
| 0.5 | Accounts in the app (sign in, `minClient` check, upload wrapped keys) | API v1 |
| 0.6 | Vault sync: push, pull, conflict copies, moving a local vault to an account | Server schema 2 |
| 0.7 | Todos sync on the same engine | Local schema 3 |
| 1.0 | Stable: Windows Hello unlock, signed installer; API v1 and vault format 2 supported for 12 months after any replacement | — |

## Checklist for every release

- Did any stored shape change? Add a numbered migration and a fixture.
- Does an older install still open this version's data read-only without crashing?
- Did the server change? Deploy and verify it on staging first.
- Is the new feature behind a flag, and does the app work with it off?
- Install the previous release, add data, upgrade, and check nothing was lost.
- Do the release notes explain any data change and how to restore a backup?
