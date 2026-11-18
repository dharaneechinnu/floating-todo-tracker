/*
 * Schema 1: the first versioned shape of config.json.
 *
 * Before this, the file had no schemaVersion and todos created by early
 * builds can be missing fields added later (prNumber, priority, dueDate,
 * pomodoros...). Fill every missing field with the value todos:add uses
 * today, so later code and later migrations can rely on them existing.
 * Unknown fields are kept as-is (rule R4).
 */
const TODO_DEFAULTS = {
  done: false,
  prNumber: "",
  blocked: false,
  feedback: "",
  pomodoros: 0,
  priority: "",
  dueDate: "",
};

module.exports = {
  version: 1,
  description: "Record a schema version and backfill missing todo fields",
  up(data) {
    const todos = Array.isArray(data.todos) ? data.todos : [];
    data.todos = todos
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        ...TODO_DEFAULTS,
        ...t,
        createdAt: typeof t.createdAt === "number" ? t.createdAt : 0,
      }));

    const highestId = data.todos.reduce(
      (max, t) => (typeof t.id === "number" && t.id > max ? t.id : max),
      0
    );
    if (!Number.isInteger(data.nextTodoId) || data.nextTodoId <= highestId) {
      data.nextTodoId = highestId + 1;
    }
    return data;
  },
};
