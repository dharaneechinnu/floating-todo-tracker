const fs = require("fs");
const Store = require("electron-store");
const { migrate } = require("./migrations/index.js");
const { backupFile } = require("./migrations/backup.js");
const STORE_MIGRATIONS = require("./migrations/store/index.js");

// electron-store is pinned to v8 in package.json — v9+ is ESM-only and
// won't `require()` from this CommonJS main process.
//
// Never add `schemaVersion` to these defaults. electron-store merges
// defaults into an existing file on load, so a default here would stamp
// an old, unmigrated file as current and every migration would be skipped.
const store = new Store({
  defaults: {
    todos: [],
    nextTodoId: 1,
    dock: null,
    expanded: false,
    // Focus timer: the session in flight (or null), and how many focus
    // sessions have completed — the latter is what decides when the next
    // break is a long one.
    session: null,
    focusSessionsCompleted: 0,
    // Feature switches (electron/features.js) and the update channel
    // ("stable" | "beta") picked from the tray.
    features: {},
    updateChannel: "stable",
  },
});

/*
 * Bring the file up to the latest schema before main.js reads anything
 * (VERSIONING.md, rules R1–R3). main.js reads `store.dataStatus` once the
 * app is ready to tell the user if the data couldn't be opened normally.
 */
function applyMigrations(target) {
  const result = migrate(target.store, STORE_MIGRATIONS);
  target.dataStatus = { ...result, data: undefined, path: target.path };

  if (result.status === "migrated") {
    // A brand-new install has nothing on disk worth backing up.
    if (fs.existsSync(target.path) && (result.from > 0 || hasUserData(target.store))) {
      target.dataStatus.backup = backupFile(target.path, result.from);
    }
    target.store = result.data;
    return;
  }

  if (result.status === "newer" || result.status === "failed") {
    // Read-only: keep working in memory, never write over data this build
    // doesn't understand or couldn't migrate.
    target.set = () => {};
    target.delete = () => {};
    target.clear = () => {};
  }
}

function hasUserData(data) {
  return Array.isArray(data.todos) && data.todos.length > 0;
}

applyMigrations(store);

module.exports = store;
