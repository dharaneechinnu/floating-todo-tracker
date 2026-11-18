/*
 * Undo for the three ways a task leaves the list: delete, bulk delete and
 * "Clear completed". Pure functions, so they can be tested without
 * Electron; main.js keeps the last removal in memory for a few seconds.
 *
 * Each removed task remembers where it stood, so Undo puts it back in the
 * same place rather than at the end.
 */
const UNDO_WINDOW_MS = 10_000; // the toast shows 5 s; this leaves slack for a slow click

function removeTodos(todos, shouldRemove) {
  const removed = [];
  const kept = [];
  todos.forEach((todo, index) => {
    if (shouldRemove(todo)) removed.push({ todo, index });
    else kept.push(todo);
  });
  return { todos: kept, removed };
}

// Put removed tasks back at their old positions. Anything already back in
// the list (same id) is skipped, so a double Undo can't duplicate a task.
function restoreTodos(todos, removed) {
  const present = new Set(todos.map((t) => t.id));
  const next = [...todos];
  for (const { todo, index } of [...removed].sort((a, b) => a.index - b.index)) {
    if (present.has(todo.id)) continue;
    next.splice(Math.min(index, next.length), 0, todo);
    present.add(todo.id);
  }
  return next;
}

module.exports = { UNDO_WINDOW_MS, removeTodos, restoreTodos };
