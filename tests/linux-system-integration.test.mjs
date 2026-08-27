import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  linuxDefaultBrowserCommands,
  nativeBrowserCandidatesForPlatform,
  nativeSystemBrowserLabel,
  updatePolicyForPlatform,
} from '../electron/lib/platform.mjs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const preload = readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');

test('Linux native browser candidates never depend on Windows executables', () => {
  const linux = nativeBrowserCandidatesForPlatform('linux', {});
  assert.ok(linux.edge.includes('/usr/bin/microsoft-edge-stable'));
  assert.ok(linux.chrome.includes('/usr/bin/google-chrome-stable'));
  assert.ok(linux.chrome.includes('/usr/bin/chromium'));
  assert.equal(JSON.stringify(linux).includes('.exe'), false);

  const windows = nativeBrowserCandidatesForPlatform('win32', {
    PROGRAMFILES: 'C:\\Program Files',
    'PROGRAMFILES(X86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\User\\AppData\\Local',
  });
  assert.ok(windows.edge.some((item) => item.endsWith('msedge.exe')));
  assert.ok(windows.chrome.some((item) => item.endsWith('chrome.exe')));
});

test('Linux default-browser registration uses freedesktop tools without sudo', () => {
  const commands = linuxDefaultBrowserCommands('marshmallow-browser.desktop');
  assert.deepEqual(commands[0], ['xdg-settings', ['set', 'default-web-browser', 'marshmallow-browser.desktop']]);
  assert.ok(commands.some(([command, args]) => command === 'xdg-mime' && args.includes('x-scheme-handler/http')));
  assert.ok(commands.some(([command, args]) => command === 'xdg-mime' && args.includes('x-scheme-handler/https')));
  assert.ok(commands.some(([command, args]) => command === 'xdg-mime' && args.includes('x-scheme-handler/marshmallow')));
  assert.equal(JSON.stringify(commands).includes('sudo'), false);
  assert.equal(nativeSystemBrowserLabel('linux'), 'Navegador padrão do sistema');
});

test('Linux updater is package-manager-only and cannot download a Windows installer', () => {
  assert.deepEqual(updatePolicyForPlatform('linux'), { mode: 'package-manager', canDownloadInstaller: false });
  assert.deepEqual(updatePolicyForPlatform('win32'), { mode: 'windows-installer', canDownloadInstaller: true });
  assert.match(main, /updatePolicyForPlatform\(process\.platform\)/);
  assert.match(main, /if \(!updatePolicy\.canDownloadInstaller\)/);
});

test('renderer can explicitly request default-browser registration through typed IPC', () => {
  assert.match(main, /ipcMain\.handle\("browser:make-default-browser"/);
  assert.match(preload, /makeDefaultBrowser:\s*\(\)\s*=>\s*ipcRenderer\.invoke\("browser:make-default-browser"\)/);
  assert.match(types, /makeDefaultBrowser\(\):\s*Promise<\{\s*ok:\s*boolean;/);
});

test('system-facing renderer copy follows runtime platform instead of claiming Windows on Linux', () => {
  assert.match(app, /const isWindows\s*=\s*state\.platform\s*===\s*"win32"/);
  assert.doesNotMatch(app, />Configurar navegador padrão no Windows</);
  assert.doesNotMatch(app, />Navegador padrão do Windows</);
  assert.match(app, /isWindows \? \"Pasta Downloads do Windows\" : \"Pasta Downloads do sistema\"/);
  assert.match(app, /Chromium\/Electron · \{isWindows \? \"Windows\" : \"Linux\"\}/);
  assert.doesNotMatch(app, /áudio geral do Windows/);
});
