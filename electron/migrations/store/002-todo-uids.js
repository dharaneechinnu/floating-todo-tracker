const { randomUUID } = require("crypto");

/*
 * Schema 2: give every todo a UUID.
 *
 * The numeric `id` is only unique on one computer — two machines both
 * create todo #7. Sync (0.7) needs an id that never clashes, so add `uid`
 * now, long before anything depends on it. The numeric id stays as the
 * local handle the renderer and IPC already use.
 */
module.exports = {
  version: 2,
  description: "Add a UUID to every todo for cross-device sync",
  up(data) {
    data.todos = data.todos.map((t) => (t.uid ? t : { ...t, uid: randomUUID() }));
    return data;
  },
};
