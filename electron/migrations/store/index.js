// Ordered list of config.json migrations. Append only; never edit or
// reorder a migration that has shipped in a release.
module.exports = [
  require("./001-backfill-todo-fields.js"),
  require("./002-todo-uids.js"),
];
