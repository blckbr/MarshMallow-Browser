import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const smoke = readFileSync(new URL('../scripts/windows-smoke-5.0.ps1', import.meta.url), 'utf8');

test('Watch Together does not lock the source page scroll or force the video over the viewport', () => {
  const start = main.indexOf('async function createWatchPublisher(');
  const end = main.indexOf('function clearWatchDisplayMediaHandler(', start);
  const publisher = main.slice(start, end);
  assert.doesNotMatch(publisher, /enterCleanVideoMode\(/);
  assert.doesNotMatch(main, /document\.documentElement\.style\.overflow\s*=\s*['"]hidden['"]/);
  assert.doesNotMatch(main, /document\.body\.style\.overflow\s*=\s*['"]hidden['"]/);
});

test('normal web tabs explicitly enable Chromium middle-click autoscroll', () => {
  const start = main.indexOf('function createTab(');
  const end = main.indexOf('function activateTab(', start);
  const createTab = main.slice(start, end);
  assert.match(createTab, /enableBlinkFeatures:\s*["']MiddleClickAutoscroll["']/);
});

test('middle-click link disposition continues opening a background tab', () => {
  const start = main.indexOf('wc.setWindowOpenHandler');
  const end = main.indexOf('wc.on("will-navigate"', start);
  const handler = main.slice(start, end);
  assert.match(handler, /createTab\(\s*context,\s*url,\s*\{\s*activate:\s*disposition\s*!==\s*["']background-tab["']/);
});

test('Windows smoke covers Watch Together page scrolling and middle mouse behavior', () => {
  assert.match(smoke, /Watch Together[\s\S]{0,260}rolar|rolagem/i);
  assert.match(smoke, /bot[aã]o do meio|clique do meio|autoscroll/i);
});
