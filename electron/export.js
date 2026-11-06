/*
 * "Export tasks" writes this JSON file. It carries its own format number
 * and the schema version of the todos inside, so a future import can
 * migrate an old export the same way the app migrates config.json.
 */
const EXPORT_FORMAT = 1;

function buildTodoExport(todos, { appVersion, schemaVersion, now = new Date() }) {
  return {
    app: "FocusDock",
    kind: "tasks",
    exportFormat: EXPORT_FORMAT,
    appVersion,
    schemaVersion,
    exportedAt: now.toISOString(),
    count: todos.length,
    todos,
  };
}

function exportFileName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `FocusDock tasks ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

module.exports = { EXPORT_FORMAT, buildTodoExport, exportFileName };
