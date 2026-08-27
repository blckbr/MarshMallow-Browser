const { ipcRenderer } = require("electron");

async function closeMenu() {
  try {
    await ipcRenderer.invoke("browser:set-toolbar-overflow", { open: false });
  } catch {}
}

async function runAction(action) {
  await closeMenu();

  try {
    if (action === "new-tab") {
      await ipcRenderer.invoke("browser:new-tab");
      return;
    }

    if (action === "new-private-tab") {
      await ipcRenderer.invoke("browser:new-private-tab");
      return;
    }

    if (action === "library") {
      await ipcRenderer.invoke("browser:new-internal-tab", "library");
      return;
    }

    if (action === "performance") {
      await ipcRenderer.invoke("browser:new-internal-tab", "performance");
      return;
    }

    if (action === "settings") {
      await ipcRenderer.invoke("browser:new-internal-tab", "settings");
      return;
    }

    if (action === "devtools") {
      await ipcRenderer.invoke("browser:devtools");
    }
  } catch {}
}

window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("click", (event) => {
    const target = event.target;
    const button = target && typeof target.closest === "function"
      ? target.closest("[data-action]")
      : null;

    if (!button) return;

    const action = String(button.getAttribute("data-action") || "");
    if (action) void runAction(action);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    void closeMenu();
  }
});