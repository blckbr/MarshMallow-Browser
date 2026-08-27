import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('standalone Downloader Manager is fail-closed on Linux before fetching a Windows installer manifest', () => {
  assert.match(main, /async function checkDownloaderManagerAvailability[\s\S]{0,500}process\.platform\s*!==\s*["']win32["'][\s\S]{0,350}available\s*:\s*false/);
  assert.match(main, /async function openDownloaderManagerInstaller[\s\S]{0,350}process\.platform\s*!==\s*["']win32["'][\s\S]{0,300}\.exe/);
});

test('Linux downloads never hand off automatically to the Windows-only external manager', () => {
  assert.match(main, /process\.platform\s*===\s*["']win32["'][\s\S]{0,220}browserPreferences\.downloadManagerMode\s*===\s*["']external["']/);
});

test('Downloader Manager settings hide Windows-only integration on Linux', () => {
  assert.match(app, /function DownloaderManagerSettings\([^)]*isWindows[^)]*\)/);
  assert.match(app, /!isWindows[\s\S]{0,500}gerenciador integrado[\s\S]{0,500}Linux/i);
  assert.match(app, /<DownloaderManagerSettings[^>]*isWindows=\{isWindows\}/);
});
