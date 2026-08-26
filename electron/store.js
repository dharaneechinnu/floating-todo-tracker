const Store = require("electron-store");

// electron-store is pinned to v8 in package.json — v9+ is ESM-only and
// won't `require()` from this CommonJS main process.
module.exports = new Store({
  defaults: {
    todos: [],
    nextTodoId: 1,
    dock: null,
    expanded: false,
  },
});
