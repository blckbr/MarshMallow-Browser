const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("marshmallow", {
  version: "5.0.2",
  browser: {
    getState: () => ipcRenderer.invoke("browser:get-state"),
    newTab: (url) => ipcRenderer.invoke("browser:new-tab", url),
    newPrivateTab: (url) => ipcRenderer.invoke("browser:new-private-tab", url),
    newInternalTab: (page) => ipcRenderer.invoke("browser:new-internal-tab", page),
    reorderTabs: (ids) => ipcRenderer.invoke("browser:reorder-tabs", ids),
    extractText: () => ipcRenderer.invoke("browser:extract-text"),
    setChatBubble: (state) => ipcRenderer.invoke("browser:set-chat-bubble", state),
    setShellOnly: (value) => ipcRenderer.invoke("browser:set-shell-only", value),
    activateTab: (id) => ipcRenderer.invoke("browser:activate-tab", id),
    closeTab: (id) => ipcRenderer.invoke("browser:close-tab", id),
    reopenTab: () => ipcRenderer.invoke("browser:reopen-tab"),
    navigate: (input) => ipcRenderer.invoke("browser:navigate", input),
    action: (action) => ipcRenderer.invoke("browser:action", action),
    setMuted: (id, muted) => ipcRenderer.invoke("browser:set-muted", id, muted),
    setLayout: (bounds) => ipcRenderer.invoke("browser:set-layout", bounds),
    setToolbarOverflow: (payload) => ipcRenderer.invoke("browser:set-toolbar-overflow", payload),
    onToolbarOverflowState: (callback) => {
      const handler = (_event, open) => callback(Boolean(open));
      ipcRenderer.on("browser:toolbar-overflow-state", handler);
      return () => ipcRenderer.removeListener("browser:toolbar-overflow-state", handler);
    },
    setDock: (payload) => ipcRenderer.invoke("browser:set-dock", payload),
    getNavigationHistory: (direction) => ipcRenderer.invoke("browser:get-navigation-history", direction),
    goNavigationIndex: (index) => ipcRenderer.invoke("browser:go-navigation-index", index),
    getGameMode: () => ipcRenderer.invoke("browser:get-game-mode"),
    setGameMode: (setting) => ipcRenderer.invoke("browser:set-game-mode", setting),
    reportGameSignals: (signals) => ipcRenderer.invoke("browser:report-game-signals", signals),
    getPerformanceDiagnostics: () => ipcRenderer.invoke("browser:get-performance-diagnostics"),
    openSupportUrl: (url) => ipcRenderer.invoke("browser:open-support-url", url),
    checkUpdate: () => ipcRenderer.invoke("browser:check-update"),
    downloadUpdate: () => ipcRenderer.invoke("browser:download-update"),
    devTools: () => ipcRenderer.invoke("browser:devtools"),
    getPreferences: () => ipcRenderer.invoke("browser:get-preferences"),
    setPreferences: (prefs) => ipcRenderer.invoke("browser:set-preferences", prefs),
    chooseDownloadFolder: () => ipcRenderer.invoke("browser:choose-download-folder"),
    clearBrowsingData: () => ipcRenderer.invoke("browser:clear-browsing-data"),
    listCookies: (query) => ipcRenderer.invoke("browser:list-cookies", query),
    saveCookies: () => ipcRenderer.invoke("browser:save-cookies"),
    removeCookie: (cookie) => ipcRenderer.invoke("browser:remove-cookie", cookie),
    clearCookies: () => ipcRenderer.invoke("browser:clear-cookies"),
    exportCookies: (passphrase) => ipcRenderer.invoke("browser:export-cookies", passphrase),
    importCookies: (passphrase) => ipcRenderer.invoke("browser:import-cookies", passphrase),
    saveWallpaper: (payload) => ipcRenderer.invoke("browser:save-wallpaper", payload),
    applyWallpaper: (payload) => ipcRenderer.invoke("browser:apply-wallpaper", payload),
    findAudibleTabs: () => ipcRenderer.invoke("browser:find-audible-tabs"),
    sleepBackgroundTabs: () => ipcRenderer.invoke("browser:sleep-background-tabs"),
    getDownloads: () => ipcRenderer.invoke("browser:get-downloads"),
    pauseDownload: (id) => ipcRenderer.invoke("browser:pause-download", id),
    resumeDownload: (id) => ipcRenderer.invoke("browser:resume-download", id),
    cancelDownload: (id) => ipcRenderer.invoke("browser:cancel-download", id),
    openDownload: (id) => ipcRenderer.invoke("browser:open-download", id),
    showDownload: (id) => ipcRenderer.invoke("browser:show-download", id),
    clearDownloadHistory: () => ipcRenderer.invoke("browser:clear-download-history"),
    getDownloaderManager: () => ipcRenderer.invoke("browser:get-downloader-manager"),
    refreshDownloaderManager: () => ipcRenderer.invoke("browser:refresh-downloader-manager"),
    openDownloaderManagerInstaller: () => ipcRenderer.invoke("browser:open-downloader-manager-installer"),
    openDownloadsFolder: () => ipcRenderer.invoke("browser:open-downloads-folder"),
    openDefaultApps: () => ipcRenderer.invoke("browser:open-default-apps"),
    makeDefaultBrowser: () => ipcRenderer.invoke("browser:make-default-browser"),
    openNativeUrl: (url) => ipcRenderer.invoke("browser:open-native-url", url),
    getNativeEngine: () => ipcRenderer.invoke("browser:get-native-engine"),
    listExtensions: () => ipcRenderer.invoke("browser:list-extensions"),
    setExtensionSettings: (patch) => ipcRenderer.invoke("browser:set-extension-settings", patch),
    loadUnpackedExtension: () => ipcRenderer.invoke("browser:load-unpacked-extension"),
    installExtensionArchive: () => ipcRenderer.invoke("browser:install-extension-archive"),
    installExtensionUrl: (url) => ipcRenderer.invoke("browser:install-extension-url", url),
    setExtensionEnabled: (id, enabled) => ipcRenderer.invoke("browser:set-extension-enabled", id, enabled),
    reloadExtension: (id) => ipcRenderer.invoke("browser:reload-extension", id),
    setExtensionFileAccess: (id, allow) => ipcRenderer.invoke("browser:set-extension-file-access", id, allow),
    removeExtension: (id) => ipcRenderer.invoke("browser:remove-extension", id),
    openExtensionFolder: (id) => ipcRenderer.invoke("browser:open-extension-folder", id),
    packExtension: (id) => ipcRenderer.invoke("browser:pack-extension", id),
    listMedia: () => ipcRenderer.invoke("browser:list-media"),
    mediaCapabilities: () => ipcRenderer.invoke("browser:media-capabilities"),
    downloadMedia: (id, format) => ipcRenderer.invoke("browser:download-media", id, format),
    onMediaChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("browser:media-changed", listener);
      return () => ipcRenderer.removeListener("browser:media-changed", listener);
    },
    onDownloadsChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("browser:downloads-changed", listener);
      return () => ipcRenderer.removeListener("browser:downloads-changed", listener);
    },
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on("browser:state", listener);
      return () => ipcRenderer.removeListener("browser:state", listener);
    },
  },
  pdf: {
    fetchUrl: (url) => ipcRenderer.invoke("pdf:fetch-url", url),
    save: (bytes, suggestedName) => ipcRenderer.invoke("pdf:save", bytes, suggestedName),
  },
  backend: {
    request: (request) => ipcRenderer.invoke("backend:request", request),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximizeToggle: () => ipcRenderer.invoke("window:maximize-toggle"),
    close: () => ipcRenderer.invoke("window:close"),
    onMaximized: (callback) => {
      const listener = (_event, value) => callback(Boolean(value));
      ipcRenderer.on("window:maximized", listener);
      return () => ipcRenderer.removeListener("window:maximized", listener);
    },
  },
  watch: {
    startMedia: (config) => ipcRenderer.invoke("watch:start-media", config),
    stopMedia: () => ipcRenderer.invoke("watch:stop-media"),
    onStatus: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("watch:status", listener);
      return () => ipcRenderer.removeListener("watch:status", listener);
    },
  },
  ui: {
    onFocusAddress: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:focus-address", listener);
      return () => ipcRenderer.removeListener("ui:focus-address", listener);
    },
    onOpenAI: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:open-ai", listener);
      return () => ipcRenderer.removeListener("ui:open-ai", listener);
    },
    onOpenDownloads: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:open-downloads", listener);
      return () => ipcRenderer.removeListener("ui:open-downloads", listener);
    },
    onPopupBlocked: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("browser:popup-blocked", listener);
      return () => ipcRenderer.removeListener("browser:popup-blocked", listener);
    },
    onPageContext: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:page-context", listener);
      return () => ipcRenderer.removeListener("ui:page-context", listener);
    },
    onOpenWatchChat: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:open-watch-chat", listener);
      return () => ipcRenderer.removeListener("ui:open-watch-chat", listener);
    },
    onNativeAuthOpened: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("ui:native-auth-opened", listener);
      return () => ipcRenderer.removeListener("ui:native-auth-opened", listener);
    },
    onHideWatchChat: (callback) => {
      const listener = () => callback();
      ipcRenderer.on("ui:hide-watch-chat", listener);
      return () => ipcRenderer.removeListener("ui:hide-watch-chat", listener);
    },
  },
});
