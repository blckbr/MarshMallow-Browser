import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

test('BrowserContext owns independent Watch Together runtime state', () => {
  const start = main.indexOf('function createBrowserContext');
  const end = main.indexOf('function contextForWindow', start);
  const block = main.slice(start, end);

  assert.match(block, /watchPublisherWindow:\s*null/);
  assert.match(block, /watchPublisherReadyResolver:\s*null/);
  assert.match(block, /watchPublisherSession:\s*null/);
  assert.match(block, /activeCaptureFrame:\s*null/);
  assert.match(block, /currentWatchSession:\s*null/);
});

test('Watch Together publisher and capture are scoped to BrowserContext', () => {
  const start = main.indexOf('async function createWatchPublisher');
  const end = main.indexOf('function clearWatchDisplayMediaHandler', start);
  const block = main.slice(start, end);

  assert.match(block, /async function createWatchPublisher\s*\(\s*context,\s*config\s*\)/);
  assert.match(block, /const tab\s*=\s*activeTab\(\s*context\s*\)/);
  assert.match(block, /await stopWatchPublisher\(\s*context\s*\)/);
  assert.match(block, /context\.activeCaptureFrame\s*=\s*selected\.frame/);
  assert.match(block, /context\.watchPublisherWindow\s*=\s*new BrowserWindow/);
  assert.match(block, /context\.currentWatchSession\s*=\s*\{/);
  assert.match(block, /partition:\s*`mm-watch-publisher-\$\{context\.window\.id\}`/);
  assert.doesNotMatch(block, /(?:^|\n)\s*activeCaptureFrame\s*=\s*selected\.frame/);
  assert.doesNotMatch(block, /(?:^|\n)\s*watchPublisherWindow\s*=\s*new BrowserWindow/);
});

test('Watch Together status, start and stop route through sender BrowserContext', () => {
  assert.match(
    main,
    /function reportWatchStatus\s*\(\s*context,\s*status\s*\)[\s\S]{0,180}sendToContextShell\(\s*context,\s*["']watch:status["'],\s*status\s*\)/
  );

  assert.match(
    main,
    /ipcMain\.handle\("watch:start-media",\s*async\s*\(event,\s*config\)\s*=>[\s\S]{0,320}contextForWebContents\(event\.sender\)[\s\S]{0,260}createWatchPublisher\(\s*context,\s*config\s*\)/
  );

  assert.match(
    main,
    /ipcMain\.handle\("watch:stop-media",\s*\(event\)\s*=>[\s\S]{0,260}contextForWebContents\(event\.sender\)[\s\S]{0,220}stopWatchPublisher\(\s*context\s*\)/
  );
});

test('publisher events and tab closing cannot cross BrowserContexts', () => {
  assert.match(
    main,
    /function contextForWatchPublisherContents\s*\(\s*contents\s*\)[\s\S]{0,360}context\.watchPublisherWindow[\s\S]{0,220}return context/
  );

  assert.match(
    main,
    /ipcMain\.on\("watch-host:ready",\s*\(event\)\s*=>[\s\S]{0,260}contextForWatchPublisherContents\(event\.sender\)[\s\S]{0,260}context\.watchPublisherReadyResolver\?\.\(\)/
  );

  assert.match(
    main,
    /ipcMain\.on\("watch-host:status",\s*\(event,\s*payload\)\s*=>[\s\S]{0,260}contextForWatchPublisherContents\(event\.sender\)[\s\S]{0,220}reportWatchStatus\(\s*context,\s*payload\s*\)/
  );

  const closeStart = main.indexOf('async function closeTab');
  const closeEnd = main.indexOf('function reopenClosedTab', closeStart);
  const closeBlock = main.slice(closeStart, closeEnd);
  assert.match(
    closeBlock,
    /context\.currentWatchSession\?\.tabId\s*===\s*id[\s\S]{0,160}stopWatchPublisher\(\s*context\s*\)/
  );
});

test('stopping one publisher clears only that context capture state', () => {
  const start = main.indexOf('async function stopWatchPublisher');
  const end = main.indexOf('function isWatchPublisherContents', start);
  const block = main.slice(start, end);

  assert.match(block, /async function stopWatchPublisher\s*\(\s*context\s*\)/);
  assert.match(block, /context\.watchPublisherReadyResolver\s*=\s*null/);
  assert.match(block, /context\.watchPublisherWindow/);
  assert.match(block, /context\.activeCaptureFrame\s*=\s*null/);
  assert.match(block, /context\.currentWatchSession\s*=\s*null/);
  assert.match(block, /reportWatchStatus\(\s*context,/);
  assert.doesNotMatch(block, /(?:^|\n)\s*watchPublisherWindow\s*=\s*null/);
  assert.doesNotMatch(block, /(?:^|\n)\s*activeCaptureFrame\s*=\s*null/);
});
