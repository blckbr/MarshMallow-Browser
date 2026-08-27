import fs from "node:fs";

const file = "./electron/main.mjs";
const backup = "./electron/main.mjs.bak-task8b-green";

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

  const next = src.replace(regex, replacement);

  if (next === src) {
    throw new Error(`[ERRO] Nenhuma alteração em: ${label}`);
  }

  src = next;
  console.log(`[OK] ${label}`);
}

/* =========================================================
   1. fullscreenContentBounds por BrowserContext
========================================================= */

replaceOnce(
  /function fullscreenContentBounds\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function applyTabArea)/,
  block([
    "function fullscreenContentBounds(context = mainBrowserContext) {",
    "  if (",
    "    !context?.window ||",
    "    context.window.isDestroyed()",
    "  ) {",
    "    return { x: 0, y: 0, width: 1, height: 1 };",
    "  }",
    "",
    "  const area = context.window.getContentBounds();",
    "",
    "  return {",
    "    x: 0,",
    "    y: 0,",
    "    width: Math.max(1, Math.round(area.width)),",
    "    height: Math.max(1, Math.round(area.height)),",
    "  };",
    "}",
    "",
  ]),
  "fullscreenContentBounds por BrowserContext"
);

/* =========================================================
   2. applyTabArea por BrowserContext
========================================================= */

replaceOnce(
  /function applyTabArea\(\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function enterHtmlFullscreen)/,
  block([
    "function applyTabArea(context = mainBrowserContext) {",
    "  if (",
    "    shuttingDown ||",
    "    !context?.window ||",
    "    context.window.isDestroyed()",
    "  ) {",
    "    return;",
    "  }",
    "",
    "  const contextTabs = context.tabs;",
    "  const contextTabArea = context.tabArea;",
    "  const contextDockState = context.dockState;",
    "  const contextShellOnly = Boolean(context.shellOnly);",
    "  const fullscreenId = context.htmlFullscreenTabId;",
    "",
    "  // HTML fullscreen cobre toda a área da BrowserWindow daquele contexto.",
    "  if (",
    "    fullscreenId &&",
    "    contextTabs.has(fullscreenId) &&",
    "    !contextShellOnly",
    "  ) {",
    "    const fullBounds = fullscreenContentBounds(context);",
    "",
    "    for (const [id, tab] of context.tabs.entries()) {",
    "      if (!tab.view) continue;",
    "",
    "      if (id === context.htmlFullscreenTabId) {",
    "        tab.view.setBounds(fullBounds);",
    "        tab.view.setVisible(true);",
    "      } else {",
    "        tab.view.setVisible(false);",
    "      }",
    "    }",
    "",
    "    context.lastComputedPageBounds = { ...fullBounds };",
    "",
    "    if (context.isMain) {",
    "      lastComputedPageBounds = { ...fullBounds };",
    "      applyChatBubble();",
    "    }",
    "",
    "    return;",
    "  }",
    "",
    "  const area =",
    "    context.window.getContentBounds?.() ||",
    "    {",
    "      width: contextTabArea.x + contextTabArea.width,",
    "      height: contextTabArea.y + contextTabArea.height,",
    "    };",
    "",
    "  const computed = computeContentBounds({",
    "    windowWidth: area.width,",
    "    windowHeight: area.height,",
    "    shell: true,",
    "    sidebarWidth: Math.max(",
    "      0,",
    "      Math.round(contextTabArea.x)",
    "    ),",
    "    toolbarHeight: Math.max(",
    "      0,",
    "      Math.round(contextTabArea.y)",
    "    ),",
    "    dock: contextDockState,",
    "  });",
    "",
    "  const bounds = {",
    "    x: Math.max(0, Math.round(computed.page.x)),",
    "    y: Math.max(0, Math.round(computed.page.y)),",
    "    width: Math.max(120, Math.round(computed.page.width)),",
    "    height: Math.max(120, Math.round(computed.page.height)),",
    "  };",
    "",
    "  context.lastComputedPageBounds = { ...bounds };",
    "",
    "  if (context.isMain) {",
    "    lastComputedPageBounds = { ...bounds };",
    "  }",
    "",
    "  for (const tab of context.tabs.values()) {",
    "    if (tab.view) {",
    "      tab.view.setBounds(bounds);",
    "    }",
    "  }",
    "",
    "  if (context.isMain) {",
    "    applyChatBubble();",
    "  }",
    "}",
    "",
  ]),
  "applyTabArea por BrowserContext"
);

/* =========================================================
   3. enterHtmlFullscreen por BrowserContext
========================================================= */

replaceOnce(
  /function enterHtmlFullscreen\(tab\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function leaveHtmlFullscreen)/,
  block([
    "function enterHtmlFullscreen(context, tab) {",
    "  if (",
    "    !isBrowserContext(context) ||",
    "    !context.window ||",
    "    context.window.isDestroyed() ||",
    "    !tab ||",
    "    !context.tabs.has(tab.id)",
    "  ) {",
    "    return;",
    "  }",
    "",
    "  context.htmlFullscreenTabId = tab.id;",
    "",
    "  // Compatibilidade temporária do contexto principal.",
    "  if (context.isMain) {",
    "    htmlFullscreenTabId = tab.id;",
    "  }",
    "",
    "  setContextActiveTabId(context, tab.id);",
    "  setVisibleTab(context, tab.id);",
    "  applyTabArea(context);",
    "",
    "  // Durante a transição fullscreen a BrowserWindow pode mudar",
    "  // de tamanho em mais de uma etapa. Os callbacks preservam",
    "  // explicitamente o BrowserContext que originou o evento.",
    "  scheduleUiWork(() => applyTabArea(context), 0);",
    "  scheduleUiWork(() => applyTabArea(context), 80);",
    "  scheduleUiWork(() => applyTabArea(context), 260);",
    "}",
    "",
  ]),
  "enterHtmlFullscreen por BrowserContext"
);

/* =========================================================
   4. leaveHtmlFullscreen por BrowserContext
========================================================= */

replaceOnce(
  /function leaveHtmlFullscreen\(tabId = null\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function setVisibleTab)/,
  block([
    "function leaveHtmlFullscreen(context, tabId = null) {",
    "  if (!isBrowserContext(context)) return;",
    "",
    "  if (!context.htmlFullscreenTabId) return;",
    "",
    "  if (",
    "    tabId &&",
    "    context.htmlFullscreenTabId !== tabId",
    "  ) {",
    "    return;",
    "  }",
    "",
    "  context.htmlFullscreenTabId = null;",
    "",
    "  if (context.isMain) {",
    "    htmlFullscreenTabId = null;",
    "  }",
    "",
    "  setVisibleTab(",
    "    context,",
    "    contextActiveTabId(context)",
    "  );",
    "",
    "  applyTabArea(context);",
    "  scheduleUiWork(() => applyTabArea(context), 0);",
    "  scheduleUiWork(() => applyTabArea(context), 120);",
    "}",
    "",
  ]),
  "leaveHtmlFullscreen por BrowserContext"
);

/* =========================================================
   5. setVisibleTab por BrowserContext
========================================================= */

replaceOnce(
  /function setVisibleTab\(id\) \{[\s\S]*?\r?\n\}\r?\n\r?\n(?=function setShellOnly)/,
  block([
    "function setVisibleTab(context, id) {",
    "  if (!isBrowserContext(context)) return;",
    "",
    "  for (const tab of context.tabs.values()) {",
    "    if (!tab.view) continue;",
    "",
    "    tab.view.setVisible(",
    "      !context.shellOnly &&",
    "      tab.id === id",
    "    );",
    "  }",
    "}",
    "",
  ]),
  "setVisibleTab por BrowserContext"
);

/* =========================================================
   6. Eventos fullscreen das abas passam context
========================================================= */

replaceOnce(
  /wc\.on\("enter-html-full-screen",\s*\(\)\s*=>\s*enterHtmlFullscreen\(tab\)\);/,
  'wc.on("enter-html-full-screen", () => enterHtmlFullscreen(context, tab));',
  "evento enter-html-full-screen da aba"
);

replaceOnce(
  /wc\.on\("leave-html-full-screen",\s*\(\)\s*=>\s*leaveHtmlFullscreen\(tab\.id\)\);/,
  'wc.on("leave-html-full-screen", () => leaveHtmlFullscreen(context, tab.id));',
  "evento leave-html-full-screen da aba"
);

/* =========================================================
   7. activateTab usa setVisibleTab contextual
========================================================= */

{
  const start = src.indexOf("function activateTab(");
  const end = src.indexOf("function closeTab(", start);

  if (start < 0 || end <= start) {
    throw new Error("[ERRO] Não consegui delimitar activateTab.");
  }

  let part = src.slice(start, end);

  const branchStart = part.indexOf("  if (context.isMain) {");
  const tabDecl = part.indexOf("  const tab =", branchStart);

  if (branchStart < 0 || tabDecl <= branchStart) {
    throw new Error(
      "[ERRO] Não encontrei o ramo antigo de visibilidade em activateTab."
    );
  }

  part =
    part.slice(0, branchStart) +
    "  setVisibleTab(context, id);" +
    eol +
    eol +
    part.slice(tabDecl);

  src =
    src.slice(0, start) +
    part +
    src.slice(end);

  console.log("[OK] activateTab usa setVisibleTab(context, id)");
}

/* =========================================================
   8. closeTab sai do fullscreen somente no próprio contexto
========================================================= */

replaceOnce(
  /if \(\s*context\.isMain\s*&&\s*htmlFullscreenTabId === id\s*\) \{\s*leaveHtmlFullscreen\(id\);\s*\}/,
  block([
    "if (",
    "    context.htmlFullscreenTabId === id",
    "  ) {",
    "    leaveHtmlFullscreen(context, id);",
    "  }",
  ]),
  "closeTab fullscreen por contexto"
);

/* =========================================================
   9. setDockState principal chama applyTabArea(context)
========================================================= */

{
  const start = src.indexOf("function setDockState(");
  const end = src.indexOf("function", start + 20);

  if (start < 0 || end <= start) {
    throw new Error("[ERRO] Não consegui delimitar setDockState.");
  }

  let part = src.slice(start, end);

  if (!part.includes("applyTabArea();")) {
    throw new Error(
      "[ERRO] setDockState não possui applyTabArea() antigo."
    );
  }

  part = part.replace(
    "applyTabArea();",
    "applyTabArea(context);"
  );

  src =
    src.slice(0, start) +
    part +
    src.slice(end);

  console.log("[OK] dock principal usa applyTabArea(context)");
}

/* =========================================================
   10. listeners da janela privada
========================================================= */

{
  const start = src.indexOf(
    "async function createPrivateWindow"
  );
  const end = src.indexOf(
    "async function createMainWindow",
    start
  );

  if (start < 0 || end <= start) {
    throw new Error(
      "[ERRO] Não consegui delimitar createPrivateWindow."
    );
  }

  let part = src.slice(start, end);

  if (part.includes('privateWindow.on("resize"')) {
    throw new Error(
      "[ERRO] A janela privada já possui listener resize."
    );
  }

  const marker =
    '  privateWindow.on("closed", () => {';

  const pos = part.indexOf(marker);

  if (pos < 0) {
    throw new Error(
      "[ERRO] Não encontrei privateWindow.on(\"closed\")."
    );
  }

  const listeners = block([
    '  privateWindow.on("resize", () => {',
    "    applyTabArea(context);",
    "    hideToolbarOverflow(context);",
    "  });",
    "",
    '  privateWindow.on("move", () => {',
    "    hideToolbarOverflow(context);",
    "  });",
    "",
    '  privateWindow.on("enter-html-full-screen", () => {',
    "    applyTabArea(context);",
    "  });",
    "",
    '  privateWindow.on("leave-html-full-screen", () => {',
    "    leaveHtmlFullscreen(context);",
    "  });",
    "",
  ]);

  part =
    part.slice(0, pos) +
    listeners +
    part.slice(pos);

  src =
    src.slice(0, start) +
    part +
    src.slice(end);

  console.log("[OK] listeners fullscreen/resize da janela privada");
}

/* =========================================================
   11. listeners da janela principal explicitam contexto
========================================================= */

replaceOnce(
  /mainWindow\.on\("resize",\s*\(\)\s*=>\s*\{\s*applyTabArea\(\);\s*hideToolbarOverflow\(\);\s*\}\);\s*mainWindow\.on\("move",\s*hideToolbarOverflow\);\s*mainWindow\.on\("enter-html-full-screen",\s*applyTabArea\);\s*mainWindow\.on\("leave-html-full-screen",\s*\(\)\s*=>\s*leaveHtmlFullscreen\(\)\);/,
  block([
    'mainWindow.on("resize", () => {',
    "    applyTabArea(mainBrowserContext);",
    "    hideToolbarOverflow(mainBrowserContext);",
    "  });",
    '  mainWindow.on("move", () => {',
    "    hideToolbarOverflow(mainBrowserContext);",
    "  });",
    '  mainWindow.on("enter-html-full-screen", () => {',
    "    applyTabArea(mainBrowserContext);",
    "  });",
    '  mainWindow.on("leave-html-full-screen", () => {',
    "    leaveHtmlFullscreen(mainBrowserContext);",
    "  });",
  ]),
  "listeners fullscreen/resize da janela principal"
);

/* =========================================================
   12. applyTabArea inicial da janela principal
========================================================= */

replaceOnce(
  /restoreSession\(\);\s*applyTabArea\(\);/,
  block([
    "restoreSession();",
    "  applyTabArea(mainBrowserContext);",
  ]),
  "layout inicial da janela principal"
);

/* =========================================================
   13. set-layout passa pelo applyTabArea contextual
========================================================= */

{
  const start = src.indexOf(
    'ipcMain.handle("browser:set-layout"'
  );

  const end = src.indexOf(
    'ipcMain.handle("browser:set-toolbar-overflow"',
    start
  );

  if (start < 0 || end <= start) {
    throw new Error(
      "[ERRO] Não consegui delimitar browser:set-layout."
    );
  }

  let part = src.slice(start, end);

  const branchStart = part.indexOf(
    "  if (context.isMain) {"
  );

  if (branchStart < 0) {
    throw new Error(
      "[ERRO] Não encontrei ramo principal de set-layout."
    );
  }

  const returnPos = part.lastIndexOf("  return");

  if (returnPos <= branchStart) {
    throw new Error(
      "[ERRO] Não encontrei retorno de set-layout."
    );
  }

  const replacement = block([
    "  if (context.isMain) {",
    "    tabArea = nextArea;",
    "  }",
    "",
    "  applyTabArea(context);",
    "",
  ]);

  part =
    part.slice(0, branchStart) +
    replacement +
    part.slice(returnPos);

  src =
    src.slice(0, start) +
    part +
    src.slice(end);

  console.log("[OK] browser:set-layout usa applyTabArea(context)");
}

/* =========================================================
   Validação final antes de escrever
========================================================= */

if (src === original) {
  throw new Error("[ERRO] O patch não produziu alterações.");
}

if (
  !src.includes(
    'enterHtmlFullscreen(context, tab)'
  ) ||
  !src.includes(
    'leaveHtmlFullscreen(context, tab.id)'
  ) ||
  !src.includes(
    'applyTabArea(mainBrowserContext)'
  )
) {
  throw new Error(
    "[ERRO] Validação final do patch falhou."
  );
}

fs.copyFileSync(file, backup);
fs.writeFileSync(file, src, "utf8");

console.log("");
console.log("[OK] Backup:", backup);
console.log("[OK] Task 8B GREEN aplicada.");
