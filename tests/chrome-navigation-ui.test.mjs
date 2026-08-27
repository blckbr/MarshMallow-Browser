import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../scripts/windows-smoke-5.0.ps1', import.meta.url), 'utf8');

test('Ctrl+L transfers native focus from the page view to the correct browser chrome', () => {
  assert.match(
    main,
    /function focusAddressBar\s*\(\s*context\s*=\s*mainBrowserContext\s*\)[\s\S]{0,260}context\.window[\s\S]{0,260}targetWindow\.webContents\.focus\(\)[\s\S]{0,260}sendToContextShell\(\s*context,\s*["']ui:focus-address["']/,
    'focusAddressBar must focus the BrowserWindow that belongs to its BrowserContext'
  );

  assert.match(
    main,
    /focusAddressBar\(\s*targetContext\s*\)/,
    'shell shortcut must focus its own BrowserContext'
  );

  assert.match(
    main,
    /focusAddressBar\(\s*context\s*\)/,
    'page shortcut must focus its own BrowserContext'
  );
});

test('omnibox suggestions are rendered by the browser chrome, not an auxiliary WebContentsView', () => {
  assert.doesNotMatch(main, /ensureOmniboxOverlayView|omniboxOverlayView|__mmOmniboxRender/);
  assert.doesNotMatch(app, /setOmniboxOverlay/);
  assert.match(app, /className="omnibox-suggestions"/);
  assert.match(app, /addressSuggestions\.map\(/);
  assert.match(app, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/);
});

test('back/forward history is renderer-owned and its entries and close button perform real actions', () => {
  assert.doesNotMatch(main, /ensureHistoryMenuView|historyMenuView|__mmHistoryRender|browser:show-navigation-history/);
  assert.match(app, /setNavigationMenu\(/);
  assert.match(app, /getNavigationHistory\(direction\)/);
  assert.match(app, /goNavigationIndex\(item\.index\)/);
  assert.doesNotMatch(main, /hideHistoryMenu\(\)/);
  assert.match(app, /className="nav-history-close"[\s\S]{0,180}setNavigationMenu\(null\)/);
});

test('history menu mirrors desktop browsers with a full-history footer', () => {
  assert.match(app, /Mostrar histórico completo/);
  assert.match(app, /openInternalPage\("library"\)/);
});

test('browser page view is moved below the full chrome popover height so native page content cannot cover it', () => {
  assert.match(app, /omniboxPopoverHeight[^;]*\* 44 \+ 34/);
  assert.match(app, /historyPopoverHeight[^;]*Math\.min\(520,[^;]*\* 44 \+ 96\)/);
  assert.match(app, /const chromePopoverHeight\s*=/);
  assert.match(app, /--chrome-popover-height/);
  assert.match(css, /\.browser-surface\s*\{[^}]*margin-top:\s*var\(--chrome-popover-height,\s*0px\)/s);
  assert.match(css, /\.omnibox-suggestions\s*\{/);
  assert.match(css, /\.nav-history-menu\s*\{/);
  assert.match(css, /\.nav-history-list\s*\{[^}]*max-height:calc\(min\(520px,70vh\) - 78px\)/s);
});


test('resize/maximize layout has no stale calls to the removed omnibox overlay', () => {
  assert.doesNotMatch(main, /applyOmniboxOverlay\s*\(/);
  assert.doesNotMatch(main, /applyHistoryMenu\s*\(/);
});

test('toolbar overflow uses a native overlay without moving the page surface', () => {
  const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');

  assert.doesNotMatch(
    app,
    /const toolbarPopoverHeight\s*=/,
    'opening the toolbar menu must not reserve vertical space above the page'
  );

  assert.match(
    app,
    /const chromePopoverHeight\s*=\s*Math\.max\(omniboxPopoverHeight,\s*historyPopoverHeight,\s*popupPermissionHeight\)/,
    'toolbar overflow must not participate in chromePopoverHeight'
  );

  assert.match(
    app,
    /window\.marshmallow\.browser\.setToolbarOverflow/,
    'renderer must control a native toolbar-overflow layer'
  );

  assert.match(
    preload,
    /setToolbarOverflow:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("browser:set-toolbar-overflow",\s*payload\)/,
    'preload must expose the native toolbar-overflow bridge'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-toolbar-overflow"/,
    'Electron main process must own the toolbar-overflow overlay'
  );
});
test('browser toast is kept inside browser chrome instead of overlaying the native page surface', () => {
  const toastRule = css.match(/\.browser-toast\s*\{[^}]*\}/s)?.[0] || '';
  assert.match(toastRule, /top:\s*calc\(var\(--title-h\)\s*\+\s*\d+px\)/);
  assert.doesNotMatch(toastRule, /bottom:\s*22px/);
  assert.match(toastRule, /max-width:\s*min\(/);
});


test('Windows smoke explicitly validates the overflow menu layer and chrome toast visibility', () => {
  assert.match(smoke, /menu \.{3}|menu de tr[eê]s pontos|menu .*Configura[cç][oõ]es/i);
  assert.match(smoke, /toast|aviso tempor[aá]rio|mensagem tempor[aá]ria/i);
});

test('internal page content cannot stretch browser chrome beyond the viewport', () => {
  const browserGrid = css.match(/\.browser-grid\s*\{[^}]*\}/s)?.[0] || '';
  const sidebar = css.match(/\.sidebar\s*\{[^}]*\}/s)?.[0] || '';
  const mainColumn = css.match(/\.main-column\s*\{[^}]*\}/s)?.[0] || '';
  const browserSurface = css.match(/\.browser-surface\s*\{[^}]*\}/s)?.[0] || '';
  const internalScroll = css.match(/\.internal-page-scroll\s*\{[^}]*\}/s)?.[0] || '';

  assert.match(
    browserGrid,
    /grid-template-rows:\s*minmax\(0,\s*1fr\)/,
    'browser-grid must keep its only row constrained to the available viewport height'
  );

  assert.match(
    sidebar,
    /min-height:\s*0/,
    'sidebar must be allowed to shrink inside the browser grid'
  );

  assert.match(
    mainColumn,
    /min-height:\s*0/,
    'main-column must not use the internal page min-content height'
  );

  assert.match(
    mainColumn,
    /grid-template-rows:\s*var\(--toolbar-h\)\s+minmax\(0,\s*1fr\)/,
    'main-column content row must stay constrained below the toolbar'
  );

  assert.match(
    browserSurface,
    /min-height:\s*0/,
    'browser-surface must be allowed to shrink to the available row'
  );

  assert.match(internalScroll, /min-height:\s*0/);
  assert.match(internalScroll, /overflow:\s*auto/);
});
test('private tabs use the red MarshMallow logo instead of the website favicon', () => {
  assert.match(
    app,
    /tab\.private\s*\?\s*<span className="private-tab-logo"[^>]*>M<\/span>\s*:/,
    'private tabs must render the MarshMallow M as their favicon'
  );

  assert.doesNotMatch(
    app,
    /className="private-dot"/,
    'the old private badge must not be rendered over a website favicon'
  );

  const privateLogoRule =
    css.match(/\.private-tab-logo\s*\{[^}]*\}/s)?.[0] || '';

  assert.match(
    privateLogoRule,
    /color:\s*#ff4d5a/i,
    'the MarshMallow private-tab logo must be red'
  );
});
test('navigating from a private internal new tab preserves private mode', () => {
  assert.match(
    main,
    /if\s*\(!tab\.view\)\s*\{[\s\S]{0,360}createTab\(\s*context,\s*targetUrl,\s*\{[\s\S]{0,160}activate:\s*true,[\s\S]{0,160}privateMode:\s*Boolean\(tab\.private\)[\s\S]{0,80}\}\s*\)/,
    'navigation from the private new-tab page must create another private tab'
  );
});
test('private tabs are never added to closedTabs', () => {
  assert.match(
    main,
    /if\s*\(\s*!tab\.private\s*\)\s*\{[\s\S]{0,300}closedTabs\.push/,
    'closeTab must only remember non-private tabs'
  );

  assert.doesNotMatch(
    main,
    /closedTabs\.push\(\{[\s\S]{0,220}private:\s*Boolean\(tab\.private\)/,
    'closedTabs must never retain private-tab metadata or URLs'
  );
});

test('browser state is owned by BrowserContext instead of only process globals', () => {
  assert.match(
    main,
    /const browserContexts\s*=\s*new Map\(\)/,
    'main process must keep a registry of browser-window contexts'
  );

  assert.match(
    main,
    /function createBrowserContext\s*\(/,
    'each BrowserWindow must receive its own BrowserContext'
  );

  assert.match(
    main,
    /function contextForWebContents\s*\(/,
    'IPC callers must be resolvable back to their BrowserContext'
  );

  assert.match(
    main,
    /tabs:\s*new Map\(\)/,
    'each BrowserContext must own its own tabs map'
  );

  assert.match(
    main,
    /closedTabs:\s*\[\]/,
    'each BrowserContext must own its own closed-tab history'
  );

  assert.match(
    main,
    /privateMode:\s*Boolean\(/,
    'BrowserContext must explicitly identify private windows'
  );
});
test('tab lifecycle functions receive a browser context', () => {
  assert.match(
    main,
    /function createTab\(context,\s*input/,
    'createTab must receive the BrowserContext explicitly'
  );

  assert.match(
    main,
    /function createInternalTab\(context,\s*page/,
    'createInternalTab must receive the BrowserContext explicitly'
  );

  assert.match(
    main,
    /function activateTab\(context,\s*id\)/,
    'activateTab must operate inside one BrowserContext'
  );

  assert.match(
    main,
    /function closeTab\(context,\s*id\)/,
    'closeTab must operate inside one BrowserContext'
  );

  assert.match(
    main,
    /function reopenClosedTab\(context\)/,
    'reopenClosedTab must use the context-specific closedTabs'
  );

  assert.match(
    main,
    /function activeTab\(context\)/,
    'activeTab must resolve from the supplied BrowserContext'
  );
});
test('tab IPC handlers resolve BrowserContext from the sender window', () => {
  assert.match(
    main,
    /ipcMain\.handle\("browser:new-tab",\s*\(event,\s*url\)\s*=>\s*\{[\s\S]{0,260}contextForWebContents\(event\.sender\)/,
    'browser:new-tab must resolve the BrowserContext from event.sender'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:close-tab",\s*\(event,\s*id\)\s*=>\s*\{[\s\S]{0,260}contextForWebContents\(event\.sender\)/,
    'browser:close-tab must act only on the originating BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:navigate",\s*\(event,\s*input\)\s*=>\s*\{[\s\S]{0,300}contextForWebContents\(event\.sender\)/,
    'browser:navigate must resolve the BrowserContext from event.sender'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:reopen-tab",\s*\(event\)\s*=>\s*\{[\s\S]{0,220}contextForWebContents\(event\.sender\)/,
    'browser:reopen-tab must use the originating BrowserContext'
  );

  assert.match(
    main,
    /function contextForWebContents[\s\S]{0,500}getParentWindow/,
    'auxiliary child windows must resolve to the parent BrowserContext'
  );
});
test('private surfaces share one temporary Chromium session', () => {
  assert.match(
    main,
    /const PRIVATE_PARTITION\s*=\s*["']mm-private-session["']/,
    'all private surfaces must share one non-persistent partition'
  );

  assert.doesNotMatch(
    main,
    /mm-private-\$\{id\}/,
    'private tabs must not create one partition per tab'
  );

  assert.match(
    main,
    /partition:\s*effectivePrivateMode\s*\?\s*PRIVATE_PARTITION\s*:\s*TAB_PARTITION/,
    'private WebContentsViews must use the shared private partition'
  );

  assert.match(
    main,
    /function hasPrivateSurfaces\s*\(/,
    'the main process must know whether any private surface still exists'
  );

  assert.match(
    main,
    /async function clearPrivateSessionIfUnused\s*\(/,
    'private storage cleanup must be centralized'
  );

  assert.match(
    main,
    /clearStorageData\(\)/,
    'private site storage must be cleared when the last private surface closes'
  );

  assert.match(
    main,
    /clearCache\(\)/,
    'private cache must be cleared when the last private surface closes'
  );

  assert.match(
    main,
    /contextTabs\.delete\(id\)[\s\S]{0,700}clearPrivateSessionIfUnused\(\)/,
    'closing a tab must re-check whether the temporary private session can be destroyed'
  );
});
test('shared private Chromium session is configured only once', () => {
  assert.match(
    main,
    /let privateSessionConfigured\s*=\s*false/,
    'the shared private Session must track whether its handlers were configured'
  );

  assert.match(
    main,
    /function ensurePrivateSessionConfigured\s*\(/,
    'private Session configuration must be centralized'
  );

  assert.match(
    main,
    /if\s*\(\s*privateSessionConfigured\s*\)\s*return/,
    'the shared private Session must not register handlers more than once'
  );

  assert.doesNotMatch(
    main,
    /if\s*\(\s*effectivePrivateMode\s*\)\s*\{[\s\S]{0,500}configureDownloads\(/,
    'createTab must not attach download listeners once per private tab'
  );
});
test('private browsing can live in its own MarshMallow BrowserWindow', () => {
  assert.match(
    main,
    /function createBrowserWindow\s*\(/,
    'BrowserWindow creation must be reusable for normal and private windows'
  );

  assert.match(
    main,
    /function createPrivateWindow\s*\(/,
    'the main process must expose a dedicated private-window constructor'
  );

  assert.match(
    main,
    /createBrowserContext\(\s*privateWindow,\s*\{[\s\S]{0,180}privateMode:\s*true/,
    'a private BrowserWindow must own a private BrowserContext'
  );

  assert.match(
    main,
    /createTab\(\s*context,[\s\S]{0,240}privateMode:\s*true/,
    'the first browsing tab in a private window must be private'
  );

  assert.match(
    main,
    /privateWindow\.on\("closed"[\s\S]{0,500}browserContexts\.delete\(privateWindow\.id\)/,
    'closing a private window must unregister its BrowserContext'
  );

  assert.match(
    main,
    /privateWindow\.on\("closed"[\s\S]{0,700}clearPrivateSessionIfUnused\(\)/,
    'closing a private window must re-check private-session cleanup'
  );
});
test('remaining tab shell IPCs are scoped to their BrowserContext', () => {
  assert.match(
    main,
    /ipcMain\.handle\("browser:get-state",\s*\(event\)\s*=>\s*\{[\s\S]{0,260}contextForWebContents\(event\.sender\)/,
    'browser:get-state must read only the originating BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:new-private-tab",\s*\(event,\s*url\)\s*=>\s*\{[\s\S]{0,300}contextForWebContents\(event\.sender\)/,
    'browser:new-private-tab must create the tab in the originating BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:new-internal-tab",\s*\(event,\s*page\)\s*=>\s*\{[\s\S]{0,300}contextForWebContents\(event\.sender\)/,
    'browser:new-internal-tab must use the originating BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:activate-tab",\s*\(event,\s*id\)\s*=>\s*\{[\s\S]{0,260}contextForWebContents\(event\.sender\)/,
    'browser:activate-tab must not activate a tab belonging to another window'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-layout",\s*\(event,\s*bounds\)\s*=>\s*\{[\s\S]{0,320}contextForWebContents\(event\.sender\)/,
    'browser:set-layout must change only the originating BrowserContext'
  );
});
test('private browsing entry points stay inside MarshMallow', () => {
  assert.match(
    main,
    /function installContextMenu\s*\(\s*context,\s*tab\s*\)/,
    'the link context menu must know which BrowserContext owns the tab'
  );

  assert.match(
    main,
    /label:\s*["']Abrir link em nova aba["']/,
    'link menu must keep the normal new-tab action'
  );

  assert.match(
    main,
    /label:\s*["']Abrir link em nova aba privada["']/,
    'link menu must offer a private tab'
  );

  assert.match(
    main,
    /label:\s*["']Abrir link em nova janela privada["']/,
    'link menu must offer a real private MarshMallow window'
  );

  assert.match(
    main,
    /label:\s*["']Copiar endereço do link["']/,
    'link menu must allow copying the target URL'
  );

  assert.doesNotMatch(
    main,
    /label:\s*["']Abrir no navegador nativo["']/,
    'the link menu must no longer send links to Edge or another native browser'
  );

  assert.match(
    main,
    /createTab\(\s*context,\s*params\.linkURL[\s\S]{0,220}privateMode:\s*true/,
    'private-tab action must stay inside the originating BrowserContext'
  );

  assert.match(
    main,
    /createPrivateWindow\(\s*params\.linkURL\s*\)/,
    'private-window action must open the clicked URL in MarshMallow'
  );

  assert.match(
    main,
    /clipboard\.writeText\(\s*params\.linkURL\s*\)/,
    'copy-link action must copy the clicked URL'
  );

  assert.match(
    main,
    /function handleShellShortcuts[\s\S]{0,2200}key\s*===\s*["']n["'][\s\S]{0,300}createPrivateWindow\(/,
    'Ctrl+Shift+N must work while browser chrome has focus'
  );

  assert.match(
    main,
    /function handleTabShortcuts[\s\S]{0,2200}key\s*===\s*["']n["'][\s\S]{0,300}createPrivateWindow\(/,
    'Ctrl+Shift+N must also work while a webpage has focus'
  );
});
test('window controls act on the BrowserWindow that sent the IPC', () => {
  assert.match(
    main,
    /ipcMain\.handle\("window:minimize",\s*\(event\)\s*=>\s*\{[\s\S]{0,280}BrowserWindow\.fromWebContents\(event\.sender\)/,
    'minimize must resolve the BrowserWindow that sent the IPC'
  );

  assert.match(
    main,
    /ipcMain\.handle\("window:maximize-toggle",\s*\(event\)\s*=>\s*\{[\s\S]{0,320}BrowserWindow\.fromWebContents\(event\.sender\)/,
    'maximize must resolve the BrowserWindow that sent the IPC'
  );

  assert.match(
    main,
    /ipcMain\.handle\("window:close",\s*\(event\)\s*=>\s*\{[\s\S]{0,280}BrowserWindow\.fromWebContents\(event\.sender\)/,
    'close must resolve the BrowserWindow that sent the IPC'
  );

  assert.doesNotMatch(
    main,
    /ipcMain\.handle\("window:minimize",\s*\(\)\s*=>\s*mainWindow/,
    'window:minimize must not control mainWindow globally'
  );

  assert.doesNotMatch(
    main,
    /ipcMain\.handle\("window:close",\s*\(\)\s*=>\s*mainWindow/,
    'window:close must not control mainWindow globally'
  );
});

test('private BrowserContext sends tab state to its own shell', () => {
  assert.match(
    main,
    /function sendToContextShell\s*\(\s*context,\s*channel,\s*\.\.\.args\s*\)/,
    'multi-window shell messaging needs a context-scoped sender'
  );

  assert.match(
    main,
    /function emitContextState\s*\(\s*context\s*\)[\s\S]{0,650}sendToContextShell\(\s*context,\s*["']browser:state["'],\s*allTabsState\(context\)\s*\)/,
    'emitContextState must send each BrowserContext its own tab snapshot'
  );

  assert.match(
    main,
    /function emitContextState\s*\(\s*context\s*\)[\s\S]{0,750}if\s*\(\s*context\.isMain\s*\)[\s\S]{0,180}scheduleSaveSession\(\)/,
    'only the normal main context may persist session state'
  );

  assert.doesNotMatch(
    main,
    /function emitContextState\s*\(\s*context\s*\)[\s\S]{0,220}if\s*\(\s*context\?\.isMain\s*\)\s*\{\s*emitState\(\)/,
    'private contexts must no longer be ignored'
  );
});
test('toolbar overflow belongs to the BrowserContext that opened it', () => {
  assert.match(
    main,
    /function setToolbarOverflow\s*\(\s*context,\s*payload\s*=\s*\{\}\s*\)/,
    'toolbar overflow must receive a BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-toolbar-overflow",\s*\(event,\s*payload\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,180}setToolbarOverflow\(\s*context,\s*payload\s*\)/,
    'toolbar overflow IPC must resolve the sender BrowserContext'
  );

  assert.match(
    main,
    /context\.toolbarOverflowWindow/,
    'each BrowserContext must own its toolbar overflow window'
  );

  assert.doesNotMatch(
    main,
    /ipcMain\.handle\("browser:set-toolbar-overflow",\s*\(_event,\s*payload\)\s*=>\s*setToolbarOverflow\(payload\)/,
    'toolbar overflow must not be routed globally'
  );
});

test('Watch Together dock belongs to the BrowserContext that opened it', () => {
  assert.match(
    main,
    /function setDockState\s*\(\s*context,\s*payload\s*=\s*\{\}\s*\)/,
    'dock state must receive a BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-dock",\s*\(event,\s*payload\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,180}setDockState\(\s*context,\s*payload\s*\)/,
    'dock IPC must resolve the sender BrowserContext'
  );

  assert.match(
    main,
    /click:\s*\(\)\s*=>\s*sendToContextShell\(\s*context,\s*["']ui:open-watch-chat["']\s*\)/,
    'Transmitir must open Watch Together in the tab BrowserContext'
  );

  assert.doesNotMatch(
    main,
    /ipcMain\.handle\("browser:set-dock",\s*\(_event,\s*payload\)\s*=>\s*setDockState\(payload\)/,
    'Watch Together dock must not mutate the main window globally'
  );
});
test('browser actions and navigation history are scoped by sender context', () => {
  assert.match(
    main,
    /function tabAction\s*\(\s*context,\s*action\s*\)[\s\S]{0,220}activeTab\(\s*context\s*\)/,
    'tabAction must operate on the active tab from its BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:action",\s*\(event,\s*action\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}tabAction\(\s*context,\s*action\s*\)/,
    'browser:action must resolve sender BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:get-navigation-history",\s*\(event,\s*direction\)\s*=>[\s\S]{0,320}contextForWebContents\(event\.sender\)[\s\S]{0,220}activeTab\(\s*context\s*\)/,
    'navigation history must use sender BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:go-navigation-index",\s*\(event,\s*index\)\s*=>[\s\S]{0,360}contextForWebContents\(event\.sender\)[\s\S]{0,220}activeTab\(\s*context\s*\)/,
    'navigation index must use sender BrowserContext'
  );
});

test('mute and devtools are scoped by sender context', () => {
  assert.match(
    main,
    /ipcMain\.handle\("browser:set-muted",\s*\(event,\s*id,\s*muted\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,180}context\.tabs\.get\(id\)[\s\S]{0,220}emitContextState\(\s*context\s*\)/,
    'mute must mutate only the sender BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:devtools",\s*\(event\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}activeTab\(\s*context\s*\)/,
    'DevTools must use sender BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:inspect",\s*\(event\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}activeTab\(\s*context\s*\)/,
    'Inspect must use sender BrowserContext'
  );

  assert.doesNotMatch(
    main,
    /ipcMain\.handle\("browser:set-muted",\s*\(_event,\s*id,\s*muted\)[\s\S]{0,180}tabs\.get\(id\)/,
    'private mute must not use global tabs'
  );
});

test('shell-only and address focus are scoped by BrowserContext', () => {
  assert.match(
    main,
    /function setShellOnly\s*\(\s*context,\s*value\s*\)/,
    'setShellOnly must receive BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-shell-only",\s*\(event,\s*value\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,200}setShellOnly\(\s*context,\s*value\s*\)/,
    'shell-only IPC must resolve sender BrowserContext'
  );

  assert.match(
    main,
    /function focusAddressBar\s*\(\s*context\s*=\s*mainBrowserContext\s*\)[\s\S]{0,300}context\.window[\s\S]{0,260}sendToContextShell\(\s*context,\s*["']ui:focus-address["']/,
    'focusAddressBar must focus and notify the correct BrowserContext'
  );

  assert.match(
    main,
    /handleShellShortcuts[\s\S]{0,2600}focusAddressBar\(\s*targetContext\s*\)/,
    'shell Ctrl+L must pass targetContext'
  );
});
test('fullscreen layout helpers belong to BrowserContext', () => {
  const fullStart = main.indexOf('function fullscreenContentBounds');
  const fullEnd = main.indexOf('function applyTabArea', fullStart);
  const applyStart = fullEnd;
  const applyEnd = main.indexOf('function enterHtmlFullscreen', applyStart);

  assert.ok(fullStart >= 0 && fullEnd > fullStart, 'fullscreenContentBounds block must exist');
  assert.ok(applyStart >= 0 && applyEnd > applyStart, 'applyTabArea block must exist');

  const fullBlock = main.slice(fullStart, fullEnd);
  const applyBlock = main.slice(applyStart, applyEnd);

  assert.match(
    fullBlock,
    /function fullscreenContentBounds\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/,
    'fullscreenContentBounds must receive BrowserContext'
  );

  assert.match(
    fullBlock,
    /context\.window\.getContentBounds\(\)/,
    'fullscreen bounds must come from the context BrowserWindow'
  );

  assert.doesNotMatch(
    fullBlock,
    /\bmainWindow\b/,
    'fullscreenContentBounds must not depend on mainWindow'
  );

  assert.match(
    applyBlock,
    /function applyTabArea\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/,
    'applyTabArea must receive BrowserContext'
  );

  assert.match(applyBlock, /context\.tabs/, 'layout must use context.tabs');
  assert.match(applyBlock, /context\.htmlFullscreenTabId/, 'layout must use context fullscreen state');
  assert.match(applyBlock, /context\.tabArea/, 'layout must use context.tabArea');
  assert.match(applyBlock, /context\.dockState/, 'layout must use context.dockState');
  assert.match(applyBlock, /context\.window/, 'layout must use context.window');
  assert.match(
    applyBlock,
    /context\.lastComputedPageBounds\s*=/,
    'computed page bounds must be stored on BrowserContext'
  );

  assert.doesNotMatch(
    applyBlock,
    /\bmainWindow\b/,
    'applyTabArea must not calculate against mainWindow'
  );
});

test('fullscreen tab lifecycle preserves BrowserContext', () => {
  const enterStart = main.indexOf('function enterHtmlFullscreen');
  const leaveStart = main.indexOf('function leaveHtmlFullscreen', enterStart);
  const visibleStart = main.indexOf('function setVisibleTab', leaveStart);
  const shellStart = main.indexOf('function setShellOnly', visibleStart);

  assert.ok(enterStart >= 0 && leaveStart > enterStart);
  assert.ok(visibleStart > leaveStart && shellStart > visibleStart);

  const enterBlock = main.slice(enterStart, leaveStart);
  const leaveBlock = main.slice(leaveStart, visibleStart);
  const visibleBlock = main.slice(visibleStart, shellStart);

  assert.match(
    enterBlock,
    /function enterHtmlFullscreen\s*\(\s*context,\s*tab\s*\)/,
    'enterHtmlFullscreen must receive BrowserContext'
  );

  assert.match(
    enterBlock,
    /context\.htmlFullscreenTabId\s*=\s*tab\.id/,
    'fullscreen id must live on BrowserContext'
  );

  assert.match(
    enterBlock,
    /setContextActiveTabId\(\s*context,\s*tab\.id\s*\)/,
    'fullscreen activation must update the context active tab'
  );

  assert.match(enterBlock, /setVisibleTab\(\s*context,\s*tab\.id\s*\)/);
  assert.match(enterBlock, /applyTabArea\(\s*context\s*\)/);
  assert.match(
    enterBlock,
    /scheduleUiWork\(\s*\(\)\s*=>\s*applyTabArea\(\s*context\s*\)/,
    'delayed fullscreen layout must retain BrowserContext'
  );

  assert.match(
    leaveBlock,
    /function leaveHtmlFullscreen\s*\(\s*context,\s*tabId\s*=\s*null\s*\)/,
    'leaveHtmlFullscreen must receive BrowserContext'
  );

  assert.match(leaveBlock, /context\.htmlFullscreenTabId/);
  assert.match(leaveBlock, /setVisibleTab\(\s*context,/);
  assert.match(leaveBlock, /applyTabArea\(\s*context\s*\)/);

  assert.match(
    visibleBlock,
    /function setVisibleTab\s*\(\s*context,\s*id\s*\)/,
    'tab visibility must be scoped to BrowserContext'
  );

  assert.match(visibleBlock, /context\.tabs\.values\(\)/);
  assert.match(visibleBlock, /context\.shellOnly/);

  assert.match(
    main,
    /wc\.on\("enter-html-full-screen",\s*\(\)\s*=>\s*enterHtmlFullscreen\(\s*context,\s*tab\s*\)\)/,
    'tab fullscreen event must pass its BrowserContext'
  );

  assert.match(
    main,
    /wc\.on\("leave-html-full-screen",\s*\(\)\s*=>\s*leaveHtmlFullscreen\(\s*context,\s*tab\.id\s*\)\)/,
    'tab fullscreen exit must pass its BrowserContext'
  );

  const closeStart = main.indexOf('function closeTab');
  const reopenStart = main.indexOf('function reopenClosedTab', closeStart);
  const closeBlock = main.slice(closeStart, reopenStart);

  assert.match(
    closeBlock,
    /context\.htmlFullscreenTabId\s*===\s*id[\s\S]{0,180}leaveHtmlFullscreen\(\s*context,\s*id\s*\)/,
    'closing a fullscreen tab must only leave fullscreen in its own context'
  );
});

test('normal and private windows wire fullscreen to their own context', () => {
  const privateStart = main.indexOf('async function createPrivateWindow');
  const mainStart = main.indexOf('async function createMainWindow', privateStart);
  const ipcStart = main.indexOf('ipcMain.handle("browser:get-state"', mainStart);

  assert.ok(privateStart >= 0 && mainStart > privateStart);
  assert.ok(ipcStart > mainStart);

  const privateBlock = main.slice(privateStart, mainStart);
  const mainBlock = main.slice(mainStart, ipcStart);

  assert.match(
    privateBlock,
    /privateWindow\.on\("resize",[\s\S]{0,260}applyTabArea\(\s*context\s*\)[\s\S]{0,180}hideToolbarOverflow\(\s*context\s*\)/,
    'private resize must only update private layout and toolbar'
  );

  assert.match(
    privateBlock,
    /privateWindow\.on\("move",[\s\S]{0,160}hideToolbarOverflow\(\s*context\s*\)/,
    'private move must only hide its own toolbar overlay'
  );

  assert.match(
    privateBlock,
    /privateWindow\.on\("enter-html-full-screen",[\s\S]{0,160}applyTabArea\(\s*context\s*\)/,
    'private BrowserWindow fullscreen must update private layout'
  );

  assert.match(
    privateBlock,
    /privateWindow\.on\("leave-html-full-screen",[\s\S]{0,180}leaveHtmlFullscreen\(\s*context\s*\)/,
    'private BrowserWindow fullscreen exit must use private context'
  );

  assert.match(
    mainBlock,
    /mainWindow\.on\("resize",[\s\S]{0,260}applyTabArea\(\s*mainBrowserContext\s*\)[\s\S]{0,180}hideToolbarOverflow\(\s*mainBrowserContext\s*\)/,
    'main resize must explicitly use mainBrowserContext'
  );

  assert.match(
    mainBlock,
    /mainWindow\.on\("leave-html-full-screen",[\s\S]{0,180}leaveHtmlFullscreen\(\s*mainBrowserContext\s*\)/,
    'main fullscreen exit must explicitly use mainBrowserContext'
  );
});
test('chat bubble view and state belong to BrowserContext', () => {
  const ensureStart = main.indexOf('function ensureChatBubbleView');
  const applyStart = main.indexOf('function applyChatBubble', ensureStart);
  const toolbarStart = main.indexOf('function toolbarOverflowHtml', applyStart);

  assert.ok(ensureStart >= 0 && applyStart > ensureStart);
  assert.ok(toolbarStart > applyStart);

  const ensureBlock = main.slice(ensureStart, applyStart);
  const applyBlock = main.slice(applyStart, toolbarStart);

  assert.match(
    ensureBlock,
    /function ensureChatBubbleView\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/,
    'ensureChatBubbleView must receive BrowserContext'
  );

  assert.match(
    ensureBlock,
    /context\.chatBubbleView/,
    'bubble WebContentsView must be stored on BrowserContext'
  );

  assert.match(
    ensureBlock,
    /context\.window\.contentView\.addChildView\(/,
    'bubble must be attached to the BrowserWindow that owns the context'
  );

  assert.doesNotMatch(
    ensureBlock,
    /\bmainWindow\.contentView\b/,
    'bubble creation must not attach directly to mainWindow'
  );

  assert.match(
    applyBlock,
    /function applyChatBubble\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/,
    'applyChatBubble must receive BrowserContext'
  );

  assert.match(applyBlock, /ensureChatBubbleView\(\s*context\s*\)/);
  assert.match(applyBlock, /context\.shellOnly/);
  assert.match(applyBlock, /context\.htmlFullscreenTabId/);
  assert.match(applyBlock, /context\.chatBubbleState/);
  assert.match(applyBlock, /contextActiveTabId\(\s*context\s*\)/);
  assert.match(applyBlock, /context\.tabArea/);
  assert.match(applyBlock, /context\.window\.contentView/);

  assert.doesNotMatch(
    applyBlock,
    /\bmainWindow\.contentView\b/,
    'bubble layout must never reattach to another BrowserWindow'
  );

  assert.match(
    main,
    /function setChatBubbleState\s*\(\s*context,\s*payload\s*\)[\s\S]{0,420}context\.chatBubbleState\s*=[\s\S]{0,260}applyChatBubble\(\s*context\s*\)/,
    'chat bubble state must belong to BrowserContext'
  );
});

test('chat bubble IPC routes through the owning BrowserContext', () => {
  const contextStart = main.indexOf('function contextForWebContents');
  const nextFunction = main.indexOf('\nfunction ', contextStart + 20);
  const contextBlock = main.slice(contextStart, nextFunction);

  assert.ok(contextStart >= 0, 'contextForWebContents must exist');

  assert.match(
    contextBlock,
    /context\.chatBubbleView\?\.webContents[\s\S]{0,120}contents/,
    'contextForWebContents must recognize chat bubble WebContentsView ownership'
  );

  assert.match(
    main,
    /ipcMain\.handle\("browser:set-chat-bubble",\s*\(event,\s*payload\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,200}setChatBubbleState\(\s*context,\s*payload\s*\)/,
    'browser:set-chat-bubble must use sender BrowserContext'
  );

  assert.match(
    main,
    /ipcMain\.on\("chat-bubble:open",\s*\(event\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}sendToContextShell\(\s*context,\s*["']ui:open-watch-chat["']\s*\)/,
    'left click on bubble must open Watch Together in its own window'
  );

  assert.match(
    main,
    /ipcMain\.on\("chat-bubble:hide-until-new",\s*\(event\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}sendToContextShell\(\s*context,\s*["']ui:hide-watch-chat["']\s*\)/,
    'right click on bubble must affect only its own shell'
  );
});

test('layout and shell state apply the bubble to their own context', () => {
  const layoutStart = main.indexOf('function applyTabArea');
  const enterStart = main.indexOf('function enterHtmlFullscreen', layoutStart);
  const layoutBlock = main.slice(layoutStart, enterStart);

  const shellStart = main.indexOf('function setShellOnly');
  const dockStart = main.indexOf('function sanitizeDock', shellStart);
  const shellBlock = main.slice(shellStart, dockStart);

  const createStart = main.indexOf('function createTab(');
  const activateStart = main.indexOf('function activateTab(', createStart);
  const createBlock = main.slice(createStart, activateStart);

  assert.match(
    layoutBlock,
    /applyChatBubble\(\s*context\s*\)/,
    'layout changes must refresh the bubble belonging to that BrowserContext'
  );

  assert.doesNotMatch(
    layoutBlock,
    /if\s*\(\s*context\.isMain\s*\)[\s\S]{0,100}applyChatBubble/,
    'private layout must not skip its own chat bubble'
  );

  assert.match(
    shellBlock,
    /applyChatBubble\(\s*context\s*\)/,
    'shell-only changes must refresh the bubble in the same BrowserContext'
  );

  assert.match(
    createBlock,
    /context\.window\.contentView\.addChildView[\s\S]{0,500}applyChatBubble\(\s*context\s*\)/,
    'adding a page view must restore the overlay for that same window'
  );
});

test('wallpaper is rendered only by the new-tab page and never by the global app shell', () => {
  const appBefore = css.match(/\.app::before\s*\{[^}]*\}/s)?.[0] || '';
  assert.doesNotMatch(appBefore, /--custom-wallpaper|background-image\s*:\s*var\(--custom-wallpaper\)/);
  assert.match(app, /className="newtab-wallpaper"/);
});

test('smart popup mode supports a persistent sanitized trusted-site allowlist', () => {
  const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
  assert.match(types, /trustedPopupSites:\s*string\[\]/);
  assert.match(main, /trustedPopupSites:\s*\[\]/);
  assert.match(main, /function normalizeTrustedPopupSite\(/);
  assert.match(main, /trustedPopupSites:\s*sanitizeTrustedPopupSites\(/);
  assert.match(main, /function isTrustedPopupOpener\(/);
  assert.match(main, /popupMode === "block"[\s\S]{0,220}isTrustedPopupOpener\(openerUrl\)/);
});

test('blocked popups expose one-time and permanent trust actions in browser chrome', () => {
  assert.match(app, /onPopupBlocked\(\(payload\) => setPendingPopup\(payload\)\)/);
  assert.match(app, /setPendingPopup\(payload\)/);
  assert.match(app, /Abrir desta vez/);
  assert.match(app, /Sempre permitir neste site/);
  assert.match(app, /Sites autorizados a abrir pop-ups/);
  assert.match(css, /\.popup-permission-bar\s*\{/);
  assert.match(app, /popupPermissionHeight/);
});
