import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../scripts/windows-smoke-5.0.ps1', import.meta.url), 'utf8');

test('shutdown has one guarded shell-send path and blocks sends while window is closing', () => {
  assert.match(main, /function canUseMainWindow\(\)/);
  assert.match(main, /function sendToShell\(channel, \.\.\.args\)/);
  assert.match(main, /if \(shuttingDown \|\| !canUseMainWindow\(\)\) return false/);
  assert.doesNotMatch(main, /mainWindow\?\.webContents\.send\(/);
});

test('closing the BrowserWindow arms shutdown guards before Electron destroys its WebContents', () => {
  assert.match(main, /let shuttingDown = false;/);
  assert.match(main, /mainWindow\.on\("close", \(\) => \{[\s\S]{0,420}shuttingDown = true;[\s\S]{0,220}cancelPendingUiWork\(\);[\s\S]{0,220}saveSession\(\);/);
});

test('before-quit performs storage flush once and also keeps shutdown guards armed', () => {
  assert.match(main, /app\.on\("before-quit", \(event\) => \{[\s\S]{0,400}preparingToQuit = true;[\s\S]{0,120}shuttingDown = true;[\s\S]{0,120}cancelPendingUiWork\(\)/);
  assert.match(main, /function cancelPendingUiWork\(\)[\s\S]{0,800}mediaNotifyTimers/);
  assert.match(main, /function cancelPendingUiWork\(\)[\s\S]{0,800}sessionSaveTimer/);
});

test('layout and delayed page probes are no-ops once shutdown begins', () => {
  assert.match(main, /function applyTabArea\s*\(\s*context\s*=\s*mainBrowserContext\s*\)[\s\S]{0,220}shuttingDown[\s\S]{0,220}!context\?\.window[\s\S]{0,220}context\.window\.isDestroyed\(\)[\s\S]{0,120}return;/);
  assert.match(main, /async function probeGameSignals\(context, tab\) \{[\s\S]{0,120}if \(shuttingDown\) return/);
  assert.match(main, /function scheduleSaveSession\(\) \{\s*if \(shuttingDown\) return;/);
});

test('Windows smoke explicitly rejects JavaScript error dialogs during shutdown', () => {
  assert.match(smoke, /feche completamente o MarshMallow/i);
  assert.match(smoke, /nenhuma janela de erro JavaScript/i);
});

test('game scheduler tolerates a tab whose WebContents was released during destruction', () => {
  const start = main.indexOf('function applyGameScheduler(context = mainBrowserContext)');
  const end = main.indexOf('async function probeGameSignals', start);
  const scheduler = main.slice(start, end);
  assert.match(scheduler, /if \(shuttingDown \|\| !context\) return resolveWindowBackgroundPolicy\(\[\]\);/);
  assert.match(scheduler, /for \(const tab of context\.tabs\.values\(\)\)[\s\S]{0,180}const wc = liveTabWebContents\(tab\);\s*if \(!wc\) continue;/);
  assert.doesNotMatch(scheduler, /tab\.view\.webContents\.isDestroyed\(\)/);
});


test('tab snapshots tolerate WebContents disappearing during BrowserWindow teardown', () => {
  const start = main.indexOf('function tabSnapshot(tab)');
  const end = main.indexOf('function allTabsState(', start);
  const snapshot = main.slice(start, end);
  assert.match(snapshot, /const wc = liveTabWebContents\(tab\);/);
  assert.match(snapshot, /if \(!wc\)/);
  assert.doesNotMatch(snapshot, /tab\.view\.webContents/);
});


test('emitState stops before taking tab snapshots once shutdown has started', () => {
  const start = main.indexOf('function emitState()');
  const end = main.indexOf('function chatBubbleHtml()', start);
  const emit = main.slice(start, end);
  assert.match(emit, /if \(shuttingDown\) return;/);
  assert.ok(emit.indexOf('if (shuttingDown) return;') < emit.indexOf('allTabsState()'));
});
