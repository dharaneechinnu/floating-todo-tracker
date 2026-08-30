const Store = require("electron-store");

// electron-store is pinned to v8 in package.json — v9+ is ESM-only and
// won't `require()` from this CommonJS main process.
module.exports = new Store({
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
  },
});
