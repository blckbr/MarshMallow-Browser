import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

function block(startNeedle, endNeedle) {
  const start = main.indexOf(startNeedle);
  const end = main.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0, `missing ${startNeedle}`);
  assert.ok(end > start, `missing end ${endNeedle} after ${startNeedle}`);
  return main.slice(start, end);
}

test('wireTab lifecycle routes state and popup notices through the owning BrowserContext', () => {
  const wire = block('function wireTab(context, tab)', 'function isBrowserContext');

  assert.doesNotMatch(wire, /\bsendToShell\(\s*["']browser:popup-blocked["']/,
    'private popup notices must never be sent to the main shell');
  assert.match(wire, /sendToContextShell\(\s*context,\s*["']browser:popup-blocked["']/,
    'popup notices must target the tab BrowserContext');

  assert.doesNotMatch(wire, /\bemitState\(\)/,
    'tab lifecycle events must not emit state to the global/main shell');
  assert.match(wire, /emitContextState\(\s*context\s*\)/,
    'tab lifecycle events must emit to the owning BrowserContext');

  assert.match(wire, /context\.tabs\.has\(tab\.id\)/,
    'delayed tab work must verify membership in the owning context');
  assert.doesNotMatch(wire, /(?<!\.)\btabs\.has\(tab\.id\)/,
    'delayed tab work must not use the global main tab map');

  assert.match(wire, /tab\.id\s*===\s*contextActiveTabId\(\s*context\s*\)/,
    'focus restoration must compare with the context active tab');
  assert.match(wire, /!context\.shellOnly/,
    'focus restoration must use the context shell visibility');
});

test('page context menu routes renderer UI events to its owning shell', () => {
  const menu = block('function installContextMenu(context, tab)', 'function installShellTextContextMenu');

  assert.match(menu, /sendToContextShell\(\s*context,\s*["']ui:page-context["']\s*\)/,
    'page-context event must stay in the owning BrowserWindow');
  assert.doesNotMatch(menu, /\bsendToShell\(\s*["']ui:page-context["']/,
    'page-context event must not target the global main shell');
});

test('AI and downloads shortcuts route to the BrowserContext that received the keypress', () => {
  const shell = block('function handleShellShortcuts(context = mainBrowserContext)', 'function handleTabShortcuts');
  const tab = block('function handleTabShortcuts(context, tab)', 'function tabAction');

  for (const [name, source] of [['shell', shell], ['tab', tab]]) {
    assert.match(source, /sendToContextShell\(\s*targetContext,\s*["']ui:open-ai["']\s*\)/,
      `${name} Ctrl+Shift+M must target its BrowserContext`);
    assert.match(source, /sendToContextShell\(\s*targetContext,\s*["']ui:open-downloads["']\s*\)/,
      `${name} Ctrl+J must target its BrowserContext`);
    assert.doesNotMatch(source, /\bsendToShell\(\s*["']ui:open-(?:ai|downloads)["']/,
      `${name} shortcuts must not target the global main shell`);
  }
});

test('game detection and scheduler stay inside the owning BrowserContext', () => {
  const game = block('function applyGameScheduler', 'const SUPPORT_URLS');

  assert.match(game, /function applyGameScheduler\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/,
    'game scheduler must accept BrowserContext');
  assert.match(game, /for \(const tab of context\.tabs\.values\(\)\)/,
    'game scheduler must iterate only context tabs');
  assert.match(game, /async function probeGameSignals\s*\(\s*context,\s*tab\s*\)/,
    'game probing must preserve BrowserContext');
  assert.match(game, /applyGameScheduler\(\s*context\s*\)/,
    'game probe must schedule only its own context');
  assert.match(game, /emitContextState\(\s*context\s*\)/,
    'game probe must emit state only to its own shell');
  assert.match(game, /function getActiveGameMode\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(game, /async function setActiveGameMode\s*\(\s*context,\s*input\s*=\s*\{\}\s*\)/);
  assert.match(game, /async function performanceDiagnostics\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);

  const ipc = main.slice(main.indexOf('ipcMain.handle("browser:get-game-mode"'), main.indexOf('ipcMain.handle("browser:open-support-url"'));
  assert.match(ipc, /contextForWebContents\(event\.sender\)/,
    'game IPC handlers must resolve the sender context');
  assert.doesNotMatch(ipc, /\bactiveTab\(\)/,
    'game IPC handlers must not use the global active tab');
});

test('tab ordering, text extraction, audible tabs and sleeping stay in sender BrowserContext', () => {
  const tabOps = block('function findAudibleTabs', 'function wakeSleepingTab');
  assert.match(tabOps, /function findAudibleTabs\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(tabOps, /for \(const tab of context\.tabs\.values\(\)\)/);
  assert.match(tabOps, /active:\s*tab\.id\s*===\s*contextActiveTabId\(context\)/);
  assert.match(tabOps, /function sleepBackgroundTabs\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(tabOps, /context\.currentWatchSession\?\.tabId/);
  assert.match(tabOps, /emitContextState\(context\)/);

  const stateOps = block('function reorderTabs', '// ------------------------------------------------------------------\n// Watch Together');
  assert.match(stateOps, /function reorderTabs\s*\(\s*context,\s*ids\s*\)/);
  assert.match(stateOps, /context\.tabs/);
  assert.match(stateOps, /emitContextState\(context\)/);
  assert.match(stateOps, /async function extractActivePageText\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(stateOps, /activeTab\(context\)/);

  const handlers = main.slice(main.indexOf('ipcMain.handle("browser:reorder-tabs"'), main.indexOf('ipcMain.handle("browser:get-downloads"'));
  for (const channel of ['browser:reorder-tabs', 'browser:extract-text', 'browser:find-audible-tabs', 'browser:sleep-background-tabs']) {
    const pos = handlers.indexOf(`ipcMain.handle("${channel}"`);
    assert.ok(pos >= 0, `missing ${channel}`);
  }
  assert.ok((handlers.match(/contextForWebContents\(event\.sender\)/g) || []).length >= 4,
    'tab-sensitive IPCs must resolve their sender BrowserContext');
});

test('media scanning cannot expose the normal active tab to a private sender', () => {
  const media = block('async function scanActiveMedia', 'async function saveWallpaperCopy');
  assert.match(media, /async function scanActiveMedia\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(media, /activeTab\(context\)/);
  assert.match(media, /function locateMediaCandidate\s*\(\s*context,\s*id\s*\)/);
  assert.match(media, /async function downloadMediaCandidate\s*\(\s*context,\s*id,/);
  assert.match(media, /locateMediaCandidate\(context,\s*id\)/);
  assert.match(media, /context\.window/,
    'media save dialogs must use the owning BrowserWindow rather than mainWindow');

  const ipc = main.slice(main.indexOf('ipcMain.handle("browser:list-media"'), main.indexOf('ipcMain.handle("window:minimize"'));
  assert.match(ipc, /ipcMain\.handle\("browser:list-media",\s*\(event\)/);
  assert.match(ipc, /scanActiveMedia\(context/);
  assert.match(ipc, /ipcMain\.handle\("browser:download-media",\s*\(event,/);
  assert.match(ipc, /downloadMediaCandidate\(context,/);
});

test('native-auth notifications and popup failures stay in the initiating BrowserContext', () => {
  const native = block('async function openNativeBrowserUrl', 'function googleVerificationInfo');
  assert.match(native, /async function openNativeBrowserUrl\(value,\s*\{\s*reason\s*=\s*["']manual["'],\s*context\s*=\s*mainBrowserContext\s*\}\s*=\s*\{\}\)/);
  assert.match(native, /sendToContextShell\(\s*context,\s*["']ui:native-auth-opened["']/);
  assert.doesNotMatch(native, /\bsendToShell\(/,
    'native auth must not notify the global main shell');
  assert.match(native, /async function interceptNativeAuth\(context,\s*tab,\s*targetUrl,\s*reason\)/);
  assert.match(native, /sendToContextShell\(\s*context,\s*["']browser:popup-blocked["']/);

  const wire = block('function wireTab(context, tab)', 'function isBrowserContext');
  assert.match(wire, /interceptNativeAuth\(context,\s*tab,/);
  assert.match(wire, /openNativeBrowserUrl\(url,\s*\{[\s\S]{0,120}context/);

  const navigate = main.slice(main.indexOf('ipcMain.handle("browser:navigate"'), main.indexOf('ipcMain.handle("browser:action"'));
  assert.match(navigate, /openNativeBrowserUrl\([\s\S]{0,160}context/);
});

test('site permissions and shell UI attach to the BrowserWindow that owns the sender', () => {
  const lookup = block('function tabByWebContentsId', 'function mediaCandidateId');
  assert.match(lookup, /for \(const context of browserContexts\.values\(\)\)/);
  assert.match(lookup, /for \(const tab of context\.tabs\.values\(\)\)/);

  const permissions = block('function configureSessionPermissions', 'function uniqueDownloadPath');
  assert.match(permissions, /contextForWebContents\(webContents\)/,
    'permission prompt must resolve the requesting tab context');
  assert.match(permissions, /context\?\.window/,
    'permission prompt must prefer the requester BrowserWindow');

  const shellMenu = block('function installShellTextContextMenu', 'function focusAddressBar');
  assert.match(shellMenu, /function installShellTextContextMenu\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/);
  assert.match(shellMenu, /context\.window\.webContents/);
  assert.match(shellMenu, /popup\(\{\s*window:\s*context\.window\s*\}\)/);

  const privateWindow = block('async function createPrivateWindow', 'async function createMainWindow');
  assert.match(privateWindow, /installShellTextContextMenu\(context\)/);
  assert.match(privateWindow, /privateWindow\.on\("maximize",[\s\S]{0,180}sendToContextShell\(\s*context,\s*["']window:maximized["'],\s*true/);
  assert.match(privateWindow, /privateWindow\.on\("unmaximize",[\s\S]{0,180}sendToContextShell\(\s*context,\s*["']window:maximized["'],\s*false/);
});

test('download-folder dialog is parented to the BrowserContext that requested it', () => {
  const handler = main.slice(main.indexOf('ipcMain.handle("browser:choose-download-folder"'), main.indexOf('ipcMain.handle("browser:clear-browsing-data"'));
  assert.match(handler, /\(event\)/);
  assert.match(handler, /contextForWebContents\(event\.sender\)/);
  assert.match(handler, /dialog\.showOpenDialog\(context\.window,/);
  assert.doesNotMatch(handler, /dialog\.showOpenDialog\(mainWindow,/);
});

test('context-menu page tools stay in the BrowserContext where they were invoked', () => {
  const tools = block('async function savePageAs', 'function appendSpellingSuggestions');
  assert.match(tools, /async function savePageAs\s*\(\s*context,\s*tab\s*\)/);
  assert.match(tools, /dialog\.showSaveDialog\(context\.window,/);
  assert.match(tools, /function translatePageToPortuguese\s*\(\s*context,\s*tab,/);
  assert.match(tools, /createTab\(\s*context,\s*translated,/);
  assert.match(tools, /async function showPageQrCode\s*\(\s*context,\s*tab\s*\)/);
  assert.match(tools, /parent:\s*context\.window/);
  assert.match(tools, /function openPageSource\s*\(\s*context,\s*tab\s*\)/);
  assert.match(tools, /createTab\(\s*context,\s*`view-source:/);

  const menu = block('function installContextMenu(context, tab)', 'function installShellTextContextMenu');
  assert.match(menu, /savePageAs\(context,\s*tab\)/);
  assert.match(menu, /showPageQrCode\(context,\s*tab\)/);
  assert.match(menu, /translatePageToPortuguese\(context,\s*tab,/);
  assert.match(menu, /openPageSource\(context,\s*tab\)/);
});

test('closing one BrowserWindow does not globally shut down surviving browser contexts', () => {
  assert.match(main, /function hasOtherLiveBrowserContext\s*\(\s*excludedContext\s*\)/);
  const privateBlock = block('async function createPrivateWindow', 'async function createMainWindow');
  const mainBlock = main.slice(main.indexOf('async function createMainWindow'), main.indexOf('ipcMain.handle("browser:get-state"'));

  assert.match(privateBlock, /privateWindow\.on\("close",[\s\S]{0,300}hasOtherLiveBrowserContext\(context\)[\s\S]{0,220}shuttingDown\s*=\s*true/,
    'private close may arm process shutdown only when no other browser context survives');
  assert.match(mainBlock, /mainWindow\.on\("close",[\s\S]{0,320}hasOtherLiveBrowserContext\(mainBrowserContext\)[\s\S]{0,220}shuttingDown\s*=\s*true/,
    'main close may arm process shutdown only when no other browser context survives');
  assert.match(mainBlock, /browserContexts\.delete\(/,
    'closed main BrowserContext must not remain in the context registry');
});
