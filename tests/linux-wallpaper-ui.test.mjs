import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

test('new-tab wallpaper system actions are rendered only on Windows', () => {
  assert.match(app, /<NewTabPage[\s\S]{0,900}isWindows=\{isWindows\}/);
  assert.match(app, /function NewTabPage\([^\n]*isWindows/);
  const page = app.slice(app.indexOf('function NewTabPage'), app.indexOf('function InternalPageHeader'));
  assert.match(page, /\{isWindows && <>[\s\S]*onWallpaperAction\("desktop"[\s\S]*onWallpaperAction\("lockscreen"[\s\S]*<\/>\}/);
});

test('non-Windows wallpaper application remains fail-closed in the main process', () => {
  const handler = main.slice(main.indexOf('async function applyWallpaperToWindows'), main.indexOf('function configureDownloadHandling'));
  assert.match(handler, /if \(process\.platform !== "win32"\) return \{ ok: false/);
});
