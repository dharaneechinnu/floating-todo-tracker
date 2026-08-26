const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fx", {
  toggleExpand: (next) => ipcRenderer.invoke("bubble:toggle-expand", next),
  getExpanded: () => ipcRenderer.invoke("bubble:get-expanded"),
  onExpandedState: (callback) => {
    const listener = (_event, expanded) => callback(expanded);
    ipcRenderer.on("bubble:expanded-state", listener);
    return () => ipcRenderer.removeListener("bubble:expanded-state", listener);
  },
  getTodos: () => ipcRenderer.invoke("todos:get"),
  addTodo: (text) => ipcRenderer.invoke("todos:add", text),
  toggleTodo: (id) => ipcRenderer.invoke("todos:toggle", id),
  deleteTodo: (id) => ipcRenderer.invoke("todos:delete", id),
  reorderTodos: (orderedIds) => ipcRenderer.invoke("todos:reorder", orderedIds),
});
