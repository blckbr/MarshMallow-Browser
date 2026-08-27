import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const platformUrl = new URL('../electron/lib/platform.mjs', import.meta.url);
const platform = existsSync(platformUrl) ? readFileSync(platformUrl, 'utf8') : '';
const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const types = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');


test('Linux platform helper exists and exposes deterministic platform primitives', () => {
  assert.equal(existsSync(platformUrl), true, 'electron/lib/platform.mjs must exist');
  assert.match(platform, /export function runtimePlatformInfo\(/);
  assert.match(platform, /export function appIconFilename\(/);
  assert.match(platform, /export function cleanUserAgentPlatform\(/);
  assert.match(platform, /export function defaultNativeBrowser\(/);
});


test('browser state exposes runtime platform to the renderer', () => {
  assert.match(main, /platform:\s*process\.platform/);
  assert.match(types, /export type BrowserState\s*=\s*\{[\s\S]*platform:\s*string;/);
  assert.match(app, /useState<BrowserState>\(\{[^}]*platform:/);
});


test('main runtime selects icon, clean UA and native browser defaults by platform', () => {
  assert.match(main, /appIconFilename\(process\.platform\)/);
  assert.match(main, /cleanUserAgentPlatform\(process\.platform\)/);
  assert.match(main, /defaultNativeBrowser\(process\.platform\)/);
  assert.doesNotMatch(main, /`Mozilla\/5\.0 \(Windows NT 10\.0; Win64; x64\) `/);
});
