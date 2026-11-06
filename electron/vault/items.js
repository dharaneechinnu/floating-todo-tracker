/*
 * Sections and notes inside the vault, and the merge rules for sync.
 * Pure functions: they take the vault data and the vault key and return
 * new data, so the rules can be tested without Electron or a server.
 *
 * Stored item: { id, kind, parentId, data: {v,iv,ct,tag}, rev, updatedAt,
 *                deleted, dirty }
 * Decrypted content (inside `data`): { title, body, username, password,
 *                url, color, ... } — anything else is kept (VERSIONING R4).
 */
const { randomUUID } = require("crypto");
const { sealJson, openJson, itemContext } = require("./crypto.js");

const KINDS = ["section", "note", "login"];

function decrypt(vaultKey, item) {
  return openJson(vaultKey, item.data, itemContext(item.id, item.kind));
}

function encrypt(vaultKey, id, kind, content) {
  return sealJson(vaultKey, content, itemContext(id, kind));
}

function createItem(vault, vaultKey, { kind, parentId = null, content }, now = Date.now()) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown item kind: ${kind}`);
  if (kind !== "section" && !vault.items.some((i) => i.id === parentId && i.kind === "section" && !i.deleted)) {
    throw new Error("A note needs a section to live in.");
  }
  const id = randomUUID();
  const item = {
    id,
    kind,
    parentId: kind === "section" ? null : parentId,
    data: encrypt(vaultKey, id, kind, content),
    rev: 1,
    updatedAt: now,
    deleted: false,
    dirty: true,
  };
  return { vault: { ...vault, items: [...vault.items, item] }, item };
}

// `changes` is merged into the decrypted content, so fields this version
// doesn't edit (or doesn't know) survive the save.
function updateItem(vault, vaultKey, id, changes, now = Date.now()) {
  const current = vault.items.find((i) => i.id === id && !i.deleted);
  if (!current) throw new Error("That item no longer exists.");
  const content = { ...decrypt(vaultKey, current), ...changes };
  const next = {
    ...current,
    data: encrypt(vaultKey, id, current.kind, content),
    rev: current.rev + 1,
    updatedAt: now,
    dirty: true,
  };
  return { ...vault, items: vault.items.map((i) => (i.id === id ? next : i)) };
}

/*
 * Deleting keeps a tombstone so the delete can reach other computers.
 * The encrypted content is replaced with an empty object. Deleting a
 * section deletes the notes in it.
 */
function deleteItem(vault, vaultKey, id, now = Date.now()) {
  const doomed = new Set([id]);
  for (const i of vault.items) if (i.parentId === id) doomed.add(i.id);
  return {
    ...vault,
    items: vault.items.map((i) =>
      doomed.has(i.id) && !i.deleted
        ? { ...i, data: encrypt(vaultKey, i.id, i.kind, {}), rev: i.rev + 1, updatedAt: now, deleted: true, dirty: true }
        : i
    ),
  };
}

// Titles and safe summaries only: no bodies or passwords leave this call.
function listItems(vault, vaultKey) {
  const live = vault.items.filter((i) => !i.deleted);
  const counts = {};
  for (const i of live) if (i.parentId) counts[i.parentId] = (counts[i.parentId] || 0) + 1;
  return live.map((i) => {
    const c = decrypt(vaultKey, i);
    return {
      id: i.id,
      kind: i.kind,
      parentId: i.parentId,
      title: c.title || "",
      color: c.color || null,
      username: i.kind === "login" ? c.username || "" : undefined,
      noteCount: i.kind === "section" ? counts[i.id] || 0 : undefined,
      updatedAt: i.updatedAt,
    };
  });
}

/*
 * Apply items pulled from the server.
 *   ours has no unsynced edits: take theirs if its rev is higher.
 *   ours has unsynced edits and theirs is older: keep ours; it uploads next.
 *   ours has unsynced edits and theirs is the same rev or newer: another
 *   computer edited it too. Two separate edits can reach the same rev, so
 *   an equal rev is NOT the same content. Take theirs AND keep ours as a
 *   new "(conflict copy)" item, so nobody's edit vanishes.
 * Returns the new vault and how many conflict copies were made.
 */
function applyRemote(vault, vaultKey, remoteItems, now = Date.now()) {
  let items = [...vault.items];
  let conflicts = 0;

  for (const remote of remoteItems) {
    const index = items.findIndex((i) => i.id === remote.id);
    const incoming = {
      id: remote.id,
      kind: remote.kind,
      parentId: remote.parentId ?? null,
      data: remote.data,
      rev: remote.rev,
      updatedAt: Date.parse(remote.updatedAt) || now,
      deleted: remote.deleted,
      dirty: false,
    };

    if (index === -1) {
      items.push(incoming);
      continue;
    }
    const local = items[index];
    if (local.dirty ? remote.rev < local.rev : remote.rev <= local.rev) continue;

    if (local.dirty && !local.deleted && KINDS.includes(local.kind)) {
      const content = decrypt(vaultKey, local);
      const copyId = randomUUID();
      items.push({
        ...local,
        id: copyId,
        data: encrypt(vaultKey, copyId, local.kind, { ...content, title: `${content.title || "Untitled"} (conflict copy)` }),
        rev: 1,
        updatedAt: now,
        dirty: true,
      });
      conflicts += 1;
    }
    items[index] = incoming;
  }

  return { vault: { ...vault, items }, conflicts };
}

// Items waiting to upload, in the shape POST /v1/sync/push takes.
function pendingPush(vault) {
  return vault.items
    .filter((i) => i.dirty)
    .map(({ id, kind, parentId, data, rev, deleted }) => ({ id, kind, parentId, data, rev, deleted }));
}

function markPushed(vault, accepted) {
  const done = new Map(accepted.map((a) => [a.id, a.rev]));
  return {
    ...vault,
    items: vault.items.map((i) => (done.get(i.id) === i.rev ? { ...i, dirty: false } : i)),
  };
}

module.exports = {
  KINDS,
  decrypt,
  createItem,
  updateItem,
  deleteItem,
  listItems,
  applyRemote,
  pendingPush,
  markPushed,
};
