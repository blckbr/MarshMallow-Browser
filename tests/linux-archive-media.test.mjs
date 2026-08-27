import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

test('extension archive extraction has a Linux unzip path with preflight limits', () => {
  assert.match(main, /async function safeExtractZipOnLinux\(/);
  assert.match(main, /runSystemCommand\("unzip",\s*\["-Z1"/);
  assert.match(main, /runSystemCommand\("unzip",\s*\["-l"/);
  assert.match(main, /EXTENSION_ENTRY_LIMIT/);
  assert.match(main, /EXTENSION_EXTRACT_LIMIT/);
  assert.match(main, /Caminho inseguro dentro do ZIP/);
  assert.match(main, /const extractZip = process\.platform === "win32" \? safeExtractZipOnWindows : safeExtractZipOnLinux/);
  assert.match(main, /async function safeExtractZipOnWindows\([\s\S]{0,5000}runPowerShellScript/);
});

test('extension packing uses PowerShell only on Windows and zip on Linux', () => {
  const pack = main.slice(main.indexOf('async function packExtensionZip'), main.indexOf('// ------------------------------------------------------------------\n// 4.1.0 — Detector'));
  assert.match(pack, /process\.platform === "win32"/);
  assert.match(pack, /runPowerShellScript/);
  assert.match(pack, /runSystemCommand\("zip",\s*\["-q",\s*"-r"/);
});

test('FFmpeg discovery and error text are platform neutral on Linux', () => {
  const media = main.slice(main.indexOf('async function findFfmpegExecutable'), main.indexOf('async function downloadMediaCandidate'));
  assert.match(media, /const executableName = process\.platform === "win32" \? "ffmpeg\.exe" : "ffmpeg"/);
  assert.match(media, /path\.join\(process\.resourcesPath, "bin", executableName\)/);
  assert.doesNotMatch(media, /FFmpeg instalado no Windows/);
  assert.doesNotMatch(media, /coloque ffmpeg\.exe/);
});
