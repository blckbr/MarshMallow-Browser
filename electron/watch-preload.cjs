const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("watchHost", {
  onStart: (callback) => {
    const listener = (_event, config) => callback(config);
    ipcRenderer.on("watch-host:start", listener);
    return () => ipcRenderer.removeListener("watch-host:start", listener);
  },
  onStop: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("watch-host:stop", listener);
    return () => ipcRenderer.removeListener("watch-host:stop", listener);
  },
  ready: () => ipcRenderer.send("watch-host:ready"),
  status: (payload) => ipcRenderer.send("watch-host:status", payload),
});
