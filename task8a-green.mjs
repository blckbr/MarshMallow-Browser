import fs from "node:fs";

const file = "./electron/main.mjs";
const backup = "./electron/main.mjs.bak-task8a-green";

let src = fs.readFileSync(file, "utf8");
const original = src;
const eol = src.includes("\r\n") ? "\r\n" : "\n";

function block(lines) {
  return lines.join(eol);
}

function replaceOnce(regex, replacement, label) {
  const matches = src.match(regex);

  if (!matches) {
    throw new Error(`[ERRO] Não encontrei: ${label}`);
  }

  const first = src.replace(regex, replacement);

  if (first === src) {
    throw new Error(`[ERRO] Nenhuma alteração em: ${label}`);
  }

  src = first;
  console.log(`[OK] ${label}`);
}

/* ---------------------------------------------------------
   1. tabAction usa a aba ativa do BrowserContext
--------------------------------------------------------- */

replaceOnce(
  /function tabAction\(action\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function scheduleSaveSession)/,
  block([
    "function tabAction(context, action) {",
    "  const tab = activeTab(context);",
    "  if (!tab || !tab.view) return;",
    "",
    "  const wc = tab.view.webContents;",
    "  const nav = wc.navigationHistory;",
    "",
    '  if (action === "back" && nav.canGoBack()) nav.goBack();',
    '  else if (action === "forward" && nav.canGoForward()) nav.goForward();',
    '  else if (action === "reload") wc.reload();',
    '  else if (action === "reload-hard") wc.reloadIgnoringCache();',
    '  else if (action === "stop") wc.stop();',
    "}",
    "",
  ]),
  "tabAction por BrowserContext"
);

/* ---------------------------------------------------------
   2. shellOnly pertence ao contexto da janela
--------------------------------------------------------- */

replaceOnce(
  /function setShellOnly\(value\) \{\r?\n  shellOnly = Boolean\(value\);\r?\n  setVisibleTab\(activeTabId\);\r?\n  applyChatBubble\(\);\r?\n  return shellOnly;\r?\n\}/,
  block([
    "function setShellOnly(context, value) {",
    "  if (!isBrowserContext(context)) {",
    "    value = context;",
    "    context = mainBrowserContext;",
    "  }",
    "",
    "  if (!context) return true;",
    "",
    "  context.shellOnly = Boolean(value);",
    "",
    "  if (context.isMain) {",
    "    shellOnly = context.shellOnly;",
    "  }",
    "",
    "  const id = contextActiveTabId(context);",
    "",
    "  for (const tab of context.tabs.values()) {",
    "    if (!tab?.view || tab.view.webContents.isDestroyed()) continue;",
    "",
    "    try {",
    "      tab.view.setVisible(",
    "        !context.shellOnly && tab.id === id",
    "      );",
    "    } catch {}",
    "  }",
    "",
    "  // O chat bubble ainda será migrado na Task 8C.",
    "  // Enquanto isso, uma janela privada não pode alterar o bubble da principal.",
    "  if (context.isMain) {",
    "    applyChatBubble();",
    "  }",
    "",
    "  return context.shellOnly;",
    "}",
  ]),
  "setShellOnly por BrowserContext"
);

/* ---------------------------------------------------------
   3. Ctrl+L envia foco para o shell correto
--------------------------------------------------------- */

replaceOnce(
  /function focusAddressBar\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function handleShellShortcuts)/,
  block([
    "function focusAddressBar(context = mainBrowserContext) {",
    "  if (shuttingDown || !context?.window) return;",
    "",
    "  const targetWindow = context.window;",
    "",
    "  if (targetWindow.isDestroyed()) return;",
    "",
    "  try {",
    "    targetWindow.webContents.focus();",
    "  } catch {}",
    "",
    '  sendToContextShell(context, "ui:focus-address");',
    "}",
    "",
  ]),
  "focusAddressBar por BrowserContext"
);

/* ---------------------------------------------------------
   4. Ctrl+L: shell e aba remota passam contexto
--------------------------------------------------------- */

const focusCalls = [...src.matchAll(/focusAddressBar\(\);/g)];

if (focusCalls.length !== 2) {
  throw new Error(
    `[ERRO] Esperava 2 chamadas focusAddressBar();, encontrei ${focusCalls.length}.`
  );
}

src = src.replace(
  "focusAddressBar();",
  "focusAddressBar(targetContext);"
);

src = src.replace(
  "focusAddressBar();",
  "focusAddressBar(context);"
);

console.log("[OK] Ctrl+L contextual nas duas origens");

/* ---------------------------------------------------------
   5. set-shell-only resolve event.sender
--------------------------------------------------------- */

replaceOnce(
  /ipcMain\.handle\("browser:set-shell-only",\s*\(_event,\s*value\)\s*=>\s*setShellOnly\(value\)\);/,
  block([
    'ipcMain.handle("browser:set-shell-only", (event, value) => {',
    "  const context = contextForWebContents(event.sender);",
    "  if (!context) return true;",
    "  return setShellOnly(context, value);",
    "});",
  ]),
  "IPC browser:set-shell-only"
);

/* ---------------------------------------------------------
   6. ação + histórico + índice contextual
--------------------------------------------------------- */

replaceOnce(
  /ipcMain\.handle\("browser:action"[\s\S]*?(?=ipcMain\.handle\("browser:get-game-mode")/,
  block([
    'ipcMain.handle("browser:action", (event, action) => {',
    "  const context = contextForWebContents(event.sender);",
    "  if (!context) return;",
    "  return tabAction(context, action);",
    "});",
    "",
    'ipcMain.handle("browser:get-navigation-history", (event, direction) => {',
    "  const context = contextForWebContents(event.sender);",
    "",
    "  if (!context) {",
    "    return { currentIndex: 0, items: [] };",
    "  }",
    "",
    "  const tab = activeTab(context);",
    "",
    "  if (!tab?.view) {",
    "    return { currentIndex: 0, items: [] };",
    "  }",
    "",
    "  const nav = tab.view.webContents.navigationHistory;",
    "  const entries = nav.getAllEntries();",
    "  const currentIndex = nav.getActiveIndex();",
    "",
    "  return {",
    "    currentIndex,",
    "    items: buildHistoryMenu(",
    "      entries,",
    "      currentIndex,",
    "      direction,",
    "      15",
    "    ).map((item) => ({",
    "      ...item,",
    '      favicon: faviconByUrl.get(item.url) || "",',
    "    })),",
    "  };",
    "});",
    "",
    'ipcMain.handle("browser:go-navigation-index", (event, index) => {',
    "  const context = contextForWebContents(event.sender);",
    "",
    "  if (!context) return { tabs: [], activeTabId: null };",
    "",
    "  const tab = activeTab(context);",
    "",
    "  if (!tab?.view) return allTabsState(context);",
    "",
    "  const nav = tab.view.webContents.navigationHistory;",
    "  const i = Number(index);",
    "",
    "  if (",
    "    Number.isInteger(i) &&",
    "    i >= 0 &&",
    "    i < nav.getAllEntries().length",
    "  ) {",
    "    nav.goToIndex(i);",
    "  }",
    "",
    "  return allTabsState(context);",
    "});",
    "",
  ]),
  "ações e histórico por BrowserContext"
);

/* ---------------------------------------------------------
   7. mute contextual
--------------------------------------------------------- */

replaceOnce(
  /ipcMain\.handle\("browser:set-muted",\s*\(_event,\s*id,\s*muted\)\s*=>\s*\{[\s\S]*?\r?\n\}\);/,
  block([
    'ipcMain.handle("browser:set-muted", (event, id, muted) => {',
    "  const context = contextForWebContents(event.sender);",
    "  if (!context) return;",
    "",
    "  const tab = context.tabs.get(id);",
    "  if (!tab || !tab.view) return;",
    "",
    "  tab.userMuted = Boolean(muted);",
    "  syncTabAudioMute(tab);",
    "  emitContextState(context);",
    "});",
  ]),
  "mute por BrowserContext"
);

/* ---------------------------------------------------------
   8. DevTools e Inspect contextuais
--------------------------------------------------------- */

replaceOnce(
  /ipcMain\.handle\("browser:devtools"[\s\S]*?(?=ipcMain\.handle\("browser:get-preferences")/,
  block([
    'ipcMain.handle("browser:devtools", (event) => {',
    "  const context = contextForWebContents(event.sender);",
    "  if (!context) return;",
    "",
    "  const tab = activeTab(context);",
    "",
    "  if (tab?.view) {",
    '    tab.view.webContents.openDevTools({ mode: "detach" });',
    "  } else if (!context.window.isDestroyed()) {",
    '    context.window.webContents.openDevTools({ mode: "detach" });',
    "  }",
    "});",
    "",
    'ipcMain.handle("browser:inspect", (event) => {',
    "  const context = contextForWebContents(event.sender);",
    "  if (!context) return;",
    "",
    "  const tab = activeTab(context);",
    "",
    "  if (tab?.view) {",
    '    tab.view.webContents.openDevTools({ mode: "detach" });',
    "  } else if (!context.window.isDestroyed()) {",
    '    context.window.webContents.openDevTools({ mode: "detach" });',
    "  }",
    "});",
    "",
  ]),
  "DevTools e Inspect por BrowserContext"
);

if (src === original) {
  throw new Error("[ERRO] O patch não produziu alterações.");
}

fs.copyFileSync(file, backup);
fs.writeFileSync(file, src, "utf8");

console.log("");
console.log("[OK] Backup:", backup);
console.log("[OK] Task 8A GREEN aplicada.");
