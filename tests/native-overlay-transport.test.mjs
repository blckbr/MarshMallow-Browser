import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const preload = fs.readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');

test('omnibox no longer creates an auxiliary native WebContentsView', () => {
  assert.doesNotMatch(main, /omniboxOverlayView|ensureOmniboxOverlayView|__mmOmniboxRender/);
  assert.doesNotMatch(preload, /setOmniboxOverlay/);
  assert.match(app, /className="omnibox-suggestions"/);
});

test('navigation history no longer communicates through a data URL hash bridge', () => {
  assert.doesNotMatch(main, /historyMenuView|ensureHistoryMenuView|__mmHistoryRender|mm-history-select|mm-history-close/);
  assert.doesNotMatch(preload, /showNavigationHistory/);
  assert.match(app, /getNavigationHistory\(direction\)/);
  assert.match(app, /goNavigationIndex\(item\.index\)/);
});

test('renderer chrome keeps a real close action for navigation history', () => {
  assert.match(app, /className="nav-history-close"/);
  assert.match(app, /onClick=\{\(\) => setNavigationMenu\(null\)\}/);
});
