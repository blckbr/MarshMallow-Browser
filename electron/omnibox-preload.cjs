const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("marshmallowOmnibox", {
  select: (value) => ipcRenderer.send("omnibox:select", value),
  ready: () => ipcRenderer.send("omnibox:ready"),
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("omnibox:update", listener);
    return () => ipcRenderer.removeListener("omnibox:update", listener);
  },
});
