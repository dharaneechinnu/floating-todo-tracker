const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fx", {
  toggleExpand: (next) => ipcRenderer.invoke("bubble:toggle-expand", next),
  getExpanded: () => ipcRenderer.invoke("bubble:get-expanded"),
  dragBubbleStart: (screenX, screenY) => ipcRenderer.send("bubble:drag-start", { screenX, screenY }),
  dragBubbleMove: (screenX, screenY) => ipcRenderer.send("bubble:drag-move", { screenX, screenY }),
  dragBubbleEnd: () => ipcRenderer.send("bubble:drag-end"),
  onExpandedState: (callback) => {
    const listener = (_event, expanded) => callback(expanded);
    ipcRenderer.on("bubble:expanded-state", listener);
    return () => ipcRenderer.removeListener("bubble:expanded-state", listener);
  },
  getDockEdge: () => ipcRenderer.invoke("bubble:get-dock-edge"),
  onDockEdge: (callback) => {
    const listener = (_event, edge) => callback(edge);
    ipcRenderer.on("bubble:dock-edge", listener);
    return () => ipcRenderer.removeListener("bubble:dock-edge", listener);
  },
  getTodos: () => ipcRenderer.invoke("todos:get"),
  addTodo: (text) => ipcRenderer.invoke("todos:add", text),
  toggleTodo: (id) => ipcRenderer.invoke("todos:toggle", id),
  deleteTodo: (id) => ipcRenderer.invoke("todos:delete", id),
  clearCompleted: () => ipcRenderer.invoke("todos:clear-completed"),
  completeMany: (ids) => ipcRenderer.invoke("todos:complete-many", ids),
  deleteMany: (ids) => ipcRenderer.invoke("todos:delete-many", ids),
  editTodo: (id, text) => ipcRenderer.invoke("todos:edit", { id, text }),
  patchTodo: (id, patch) => ipcRenderer.invoke("todos:patch", { id, patch }),
  reorderTodos: (orderedIds) => ipcRenderer.invoke("todos:reorder", orderedIds),

  // Feature switches, changed from the tray's "Beta features" menu.
  getFeatures: () => ipcRenderer.invoke("features:get"),
  onFeaturesChanged: (callback) => {
    const listener = (_event, features) => callback(features);
    ipcRenderer.on("features:changed", listener);
    return () => ipcRenderer.removeListener("features:changed", listener);
  },

  // Secret vault. Every call resolves to { ok: true, value } or
  // { ok: false, code, message }. Keys and passphrases stay in the main
  // process; copy() writes to the clipboard from there, so a password
  // never passes through this page on its way to the clipboard.
  vault: {
    status: () => ipcRenderer.invoke("vault:status"),
    create: (passphrase) => ipcRenderer.invoke("vault:create", passphrase),
    unlock: (passphrase) => ipcRenderer.invoke("vault:unlock", passphrase),
    recover: (recoveryCode, passphrase) => ipcRenderer.invoke("vault:recover", { recoveryCode, passphrase }),
    lock: () => ipcRenderer.invoke("vault:lock"),
    list: () => ipcRenderer.invoke("vault:list"),
    open: (id) => ipcRenderer.invoke("vault:open", id),
    add: (item) => ipcRenderer.invoke("vault:add", item),
    update: (id, changes) => ipcRenderer.invoke("vault:update", { id, changes }),
    remove: (id) => ipcRenderer.invoke("vault:remove", id),
    copy: (id, field) => ipcRenderer.invoke("vault:copy", { id, field }),
    onLocked: (callback) => {
      const listener = (_event, reason) => callback(reason);
      ipcRenderer.on("vault:locked", listener);
      return () => ipcRenderer.removeListener("vault:locked", listener);
    },
  },

  // Focus timer. The main process owns the clock; the renderer only shows
  // it and sends intent.
  getFocus: () => ipcRenderer.invoke("focus:get"),
  startFocus: (phase, taskId) => ipcRenderer.invoke("focus:start", { phase, taskId }),
  pauseFocus: () => ipcRenderer.invoke("focus:pause"),
  resumeFocus: () => ipcRenderer.invoke("focus:resume"),
  stopFocus: () => ipcRenderer.invoke("focus:stop"),
  onFocusState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("focus:state", listener);
    return () => ipcRenderer.removeListener("focus:state", listener);
  },
  // A finished focus session credits a pomodoro to its task, so the list
  // changes without the renderer having asked for anything.
  onTodosChanged: (callback) => {
    const listener = (_event, todos) => callback(todos);
    ipcRenderer.on("todos:changed", listener);
    return () => ipcRenderer.removeListener("todos:changed", listener);
  },
});
