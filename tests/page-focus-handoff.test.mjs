import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

test('omnibox navigation releases React input focus before handing control to the page', () => {
  const start = app.indexOf('function navigateTo(value: string)');
  assert.notEqual(start, -1, 'missing navigateTo');
  const block = app.slice(start, app.indexOf('\n  function navigate(', start));
  assert.match(block, /addressRef\.current\?\.blur\(\)/, 'navigateTo must blur the shell omnibox');
});

test('browser:navigate defers page focus until the new main document commits', () => {
  const navStart = main.indexOf('ipcMain.handle(\"browser:navigate\"');
  assert.notEqual(navStart, -1, 'missing browser:navigate handler');
  const navEnd = main.indexOf('ipcMain.handle(\"browser:action\"', navStart);
  const navBlock = main.slice(navStart, navEnd);
  assert.match(navBlock, /focusAfterNavigation\s*=\s*true/, 'browser:navigate must arm post-navigation focus instead of focusing the old document');

  const didStart = main.indexOf('wc.on(\"did-navigate\"');
  assert.notEqual(didStart, -1, 'missing did-navigate listener');
  const didEnd = main.indexOf('wc.on(\"did-navigate-in-page\"', didStart);
  const didBlock = main.slice(didStart, didEnd);
  assert.match(didBlock, /focusAfterNavigation/, 'did-navigate must consume the pending focus handoff');
  assert.match(didBlock, /wc\.focus\(\)/, 'did-navigate must focus the newly committed page');
});

test('Google default window-open disposition stays in the current tab instead of requiring a synthetic new tab', () => {
  const start = main.indexOf('wc.setWindowOpenHandler');
  assert.notEqual(start, -1, 'missing setWindowOpenHandler');
  const end = main.indexOf('\n\n  installContextMenu', start);
  const block = main.slice(start, end);
  assert.ok(block.includes('String(disposition || \"\") === \"default\"'), 'handler must recognize Chromium default disposition');
  assert.match(block, /isGoogleSearchResultsUrl\(openerUrl\)/, 'handler must scope the current-tab exception to Google search results');
  assert.match(block, /focusAfterNavigation\s*=\s*true/, 'Google default disposition must arm focus for the committed destination');
  assert.match(block, /wc\.loadURL\(url\)/, 'Google default disposition should navigate current WebContents');
});
