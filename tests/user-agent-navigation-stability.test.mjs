import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

function listenerBlock(eventName, nextMarker) {
  const start = main.indexOf(`wc.on("${eventName}"`);
  assert.notEqual(start, -1, `missing ${eventName} listener`);
  const end = main.indexOf(nextMarker, start);
  assert.notEqual(end, -1, `missing end marker after ${eventName}`);
  return main.slice(start, end);
}

test('normal page navigation never changes User-Agent from navigation lifecycle events', () => {
  const blocks = [
    listenerBlock('will-navigate', 'wc.on("will-redirect"'),
    listenerBlock('will-redirect', 'wc.on("dom-ready"'),
    listenerBlock('did-navigate', 'wc.on("did-navigate-in-page"'),
    listenerBlock('did-navigate-in-page', 'wc.on("page-title-updated"'),
  ];

  for (const block of blocks) {
    assert.doesNotMatch(
      block,
      /applyCompatibleUserAgent|setUserAgent/,
      'navigation lifecycle must not mutate User-Agent because Chromium may restart/reload the current document'
    );
  }
});
