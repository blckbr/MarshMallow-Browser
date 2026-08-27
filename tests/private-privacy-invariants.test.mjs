import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('normal and private browsing use isolated Chromium partitions', () => {
  assert.match(main, /const TAB_PARTITION\s*=\s*["']persist:marshmallow["']/);
  assert.match(main, /const PRIVATE_PARTITION\s*=\s*["']mm-private-session["']/);
  assert.doesNotMatch(main, /persist:mm-private-session/);

  const start = main.indexOf('function createTab(');
  const end = main.indexOf('function activateTab(', start);
  const block = main.slice(start, end);
  assert.match(block, /partition:\s*effectivePrivateMode[\s\S]{0,100}\?\s*PRIVATE_PARTITION[\s\S]{0,100}:\s*TAB_PARTITION/);
});

test('last private surface clears temporary storage cache and connections', () => {
  const start = main.indexOf('async function clearPrivateSessionIfUnused');
  const end = main.indexOf('function createBrowserContext', start);
  const block = main.slice(start, end);

  assert.match(block, /if\s*\(hasPrivateSurfaces\(\)\)[\s\S]{0,100}return false/);
  assert.match(block, /session\.fromPartition\(PRIVATE_PARTITION\)/);
  assert.match(block, /clearStorageData\(\)/);
  assert.match(block, /clearCache\(\)/);
  assert.match(block, /closeAllConnections\(\)/);

  const closeStart = main.indexOf('async function closeTab');
  const closeEnd = main.indexOf('function reopenClosedTab', closeStart);
  const closeBlock = main.slice(closeStart, closeEnd);
  assert.match(closeBlock, /contextTabs\.delete\(id\)[\s\S]{0,180}if\s*\(tab\.private\)[\s\S]{0,120}clearPrivateSessionIfUnused\(\)/);
});

test('private URLs stay out of session restore browser history and persisted download history', () => {
  const saveStart = main.indexOf('function saveSession()');
  const restoreStart = main.indexOf('function restoreSession()', saveStart);
  const saveBlock = main.slice(saveStart, restoreStart);
  assert.match(saveBlock, /filter\(\(tab\)\s*=>\s*!tab\.private/);

  assert.match(app, /if\s*\(!active\s*\|\|\s*active\.private\s*\|\|\s*!\/\^https\?:\/i\.test\(active\.url\)/);

  const downloadStart = main.indexOf('function saveDownloadHistory()');
  const downloadEnd = main.indexOf('function downloadSnapshot()', downloadStart);
  const downloadBlock = main.slice(downloadStart, downloadEnd);
  assert.match(downloadBlock, /filter\(\(item\)\s*=>\s*!item\.private/);

  const configStart = main.indexOf('function configureDownloads');
  const configEnd = main.indexOf('function pauseDownload', configStart);
  const configBlock = main.slice(configStart, configEnd);
  assert.match(configBlock, /if\s*\(!privateMode\)\s*saveDownloadHistory\(\)/);
});

test('private windows never enter session restore or closed-tab recovery', () => {
  const privateStart = main.indexOf('async function createPrivateWindow');
  const mainStart = main.indexOf('async function createMainWindow', privateStart);
  const privateBlock = main.slice(privateStart, mainStart);
  assert.doesNotMatch(privateBlock, /restoreSession\(/);
  assert.doesNotMatch(privateBlock, /saveSession\(/);

  const closeStart = main.indexOf('async function closeTab');
  const closeEnd = main.indexOf('function reopenClosedTab', closeStart);
  const closeBlock = main.slice(closeStart, closeEnd);
  assert.match(closeBlock, /if\s*\(!tab\.private\)[\s\S]{0,300}closedTabs\.push/);
});

test('closing a private BrowserWindow stops its Watch Together publisher before dropping the context', () => {
  const privateStart = main.indexOf('async function createPrivateWindow');
  const mainStart = main.indexOf('async function createMainWindow', privateStart);
  const privateBlock = main.slice(privateStart, mainStart);

  assert.match(
    privateBlock,
    /privateWindow\.on\("closed",\s*async\s*\(\)\s*=>\s*\{[\s\S]{0,420}stopWatchPublisher\(\s*context\s*\)[\s\S]{0,260}browserContexts\.delete\(privateWindow\.id\)/
  );
});
