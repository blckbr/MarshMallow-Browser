const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("marshmallowHistory", {
  ready: () => ipcRenderer.send("history-menu:ready"),
  select: (index) => ipcRenderer.send("history-menu:select", Number(index)),
  close: () => ipcRenderer.send("history-menu:close"),
  onUpdate: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("history-menu:update", listener);
    return () => ipcRenderer.removeListener("history-menu:update", listener);
  },
});
