import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const main = read('electron/main.mjs');
const preload = read('electron/preload.cjs');
const app = read('src/App.tsx');
const pkg = JSON.parse(read('package.json'));

const SUPPORT = [
  'https://apoia.se/marshmallow-browser',
  'https://ko-fi.com/marshmallowbrowser',
  'https://buymeacoffee.com/marshmallowbrowser',
];

test('release identity is 5.0.2', () => {
  assert.equal(pkg.version, '5.0.2');
  assert.match(main, /const VERSION\s*=\s*"5\.0\.2"/);
  assert.match(preload, /version:\s*"5\.0\.2"/);
});

test('4.1 browser capabilities remain wired', () => {
  for (const token of ['browser:list-extensions','browser:new-private-tab','browser:reopen-tab','browser:list-media','watch:start-media']) assert.ok(main.includes(token), token);
  assert.match(main, /restoreSession|restore.*session/i);
});

test('5.0 navigation and omnibox fixes are wired', () => {
  assert.ok(main.includes('browser:get-navigation-history'));
  assert.ok(main.includes('browser:go-navigation-index'));
  assert.ok(preload.includes('getNavigationHistory'));
  assert.ok(preload.includes('goNavigationIndex'));
  assert.match(main, /function focusAddressBar\s*\(\s*context\s*=\s*mainBrowserContext\s*\)[\s\S]{0,260}context\.window[\s\S]{0,260}targetWindow\.webContents\.focus\(\)[\s\S]{0,260}sendToContextShell\(\s*context,\s*["']ui:focus-address["']/);
  assert.match(app, /className="omnibox-suggestions"/);
  assert.match(app, /className="nav-history-close"/);
  assert.match(app, /segure ou clique com o botão direito/);
});

test('5.0 toolbar exposes game media extensions and overflow', () => {
  for (const label of ['Modo Jogo','Downloader de mídia','Extensões','title="Menu"']) assert.ok(app.includes(label), label);
});

test('support is explicit and non-intrusive', () => {
  for (const url of SUPPORT) { assert.ok(main.includes(url)); assert.ok(app.includes(url)); }
  assert.ok(main.includes('marshmallow://support'));
  assert.doesNotMatch(`${main}\n${app}`, /set(?:Timeout|Interval)\([^\n]{0,300}(?:apoia\.se|ko-fi\.com|buymeacoffee\.com)/i);
});

test('game mode never weakens global web security', () => {
  assert.doesNotMatch(main, /nodeIntegration\s*:\s*true/);
  assert.doesNotMatch(main, /contextIsolation\s*:\s*false/);
  assert.doesNotMatch(main, /webSecurity\s*:\s*false/);
  assert.doesNotMatch(main, /allowRunningInsecureContent\s*:\s*true/);
});

test('protected content playback is allowed without enabling DRM circumvention', () => {
  assert.ok(main.includes('mediaKeySystem'));
  assert.ok(main.includes('drmProtectedTabs'));
  assert.ok(main.includes('function markTabDrmProtected'));
  assert.match(main, /map\.set\(id, \{ \.\.\.candidate, protected: true, drm: true \}\)/);
  assert.match(main, /não descriptografa nem contorna DRM/);
});

test('standard download manager and optional standalone integration are wired', () => {
  for (const token of ['browser:get-downloads','browser:pause-download','browser:resume-download','browser:cancel-download','browser:clear-download-history','browser:get-downloader-manager']) assert.ok(main.includes(token), token);
  for (const token of ['getDownloads','pauseDownload','resumeDownload','cancelDownload','clearDownloadHistory','getDownloaderManager','onDownloadsChanged']) assert.ok(preload.includes(token), token);
  assert.match(app, /Mídia da página/);
  assert.match(app, /MarshMallow Downloader Manager/);
  const manager = JSON.parse(read('MarshMallow-Official-Website-5.0.0/site/download/manager.json'));
  assert.equal(manager.available, false);
  assert.equal(manager.protocol, 'marshmallow-downloader');
});

test('download settings expose builtin and optional standalone manager choices', () => {
  assert.match(app, /downloadManagerMode/);
  assert.match(app, /refreshDownloaderManager/);
  assert.match(app, /Em desenvolvimento/);
  assert.match(app, /Gerenciador integrado/);
});

test('download manager mode changes immediately refresh the download panel snapshot', () => {
  assert.match(main, /previous\.downloadManagerMode\s*!==\s*browserPreferences\.downloadManagerMode[\s\S]{0,120}emitDownloadsChanged\(\)/);
});

test('Ctrl+J opens the built-in downloads view from shell and page shortcuts', () => {
  assert.match(main, /key\s*===\s*"j"[\s\S]{0,180}ui:open-downloads/);
  assert.match(preload, /onOpenDownloads[\s\S]{0,180}ui:open-downloads/);
  assert.match(app, /onOpenDownloads[\s\S]{0,220}setDownloadPanelView\("downloads"\)[\s\S]{0,120}setPanel\("media"\)/);
});

test('official download page reserves a safe optional Downloader Manager slot', () => {
  const page = read('MarshMallow-Official-Website-5.0.0/site/download/index.html');
  const script = read('MarshMallow-Official-Website-5.0.0/site/assets/download.js');
  assert.match(page, /MarshMallow Downloader Manager/);
  assert.match(page, /manager-download-button/);
  assert.match(script, /\/download\/manager\.json/);
  assert.match(script, /manager\.available/);
});

test('Windows smoke gate covers standard downloads and optional Downloader Manager integration', () => {
  const smoke = read('scripts/windows-smoke-5.0.ps1');
  assert.match(smoke, /Ctrl\+J/);
  assert.match(smoke, /MarshMallow Downloader Manager/);
  assert.match(smoke, /gerenciador integrado/i);
  assert.match(smoke, /example\.com\/docs/);
  assert.match(smoke, /segunda vez/i);
});

test('browser chrome owns autocomplete and navigation history without auxiliary WebContents', () => {
  assert.doesNotMatch(main, /omniboxOverlayView|historyMenuView|__mmOmniboxRender|__mmHistoryRender/);
  assert.doesNotMatch(preload, /setOmniboxOverlay|showNavigationHistory/);
  assert.match(app, /--chrome-popover-height/);
  assert.match(app, /goNavigationIndex\(item\.index\)/);
});
