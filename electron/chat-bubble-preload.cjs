const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("marshmallowBubble", {
  open: () => ipcRenderer.send("chat-bubble:open"),
  hideUntilNew: () => ipcRenderer.send("chat-bubble:hide-until-new"),
  onUpdate: (callback) => {
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on("chat-bubble:update", listener);
    return () => ipcRenderer.removeListener("chat-bubble:update", listener);
  },
});
