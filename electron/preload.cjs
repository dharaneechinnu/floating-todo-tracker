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
  copyToClipboard: (text) => ipcRenderer.invoke("clipboard:write", text),
});
