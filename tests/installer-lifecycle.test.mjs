import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Windows installer owns the running-app flow without electron-builder raw dialog', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build?.nsis?.include, 'build/installer.nsh');

  const nsis = read('build/installer.nsh');
  assert.match(nsis, /!macro\s+customCheckAppRunning/);
  assert.match(nsis, /--prepare-update/);
  assert.match(nsis, /KILL_PROCESS/);
  assert.match(nsis, /Var\s+pid/);
  assert.match(nsis, /GetCurrentProcessId/);
  assert.match(nsis, /\$EXEFILE/);
  assert.match(nsis, /O MarshMallow precisa ser fechado para concluir a (?:instalação|atualização)/i);
  assert.doesNotMatch(nsis, /\$\(appRunning\)|\$\(appCannotBeClosed\)/);
});

test('running MarshMallow treats installer prepare-update launch as a graceful quit request', () => {
  const main = read('electron/main.mjs');
  assert.match(main, /app\.on\("second-instance",\s*\([^)]*argv[^)]*\)\s*=>/);
  assert.match(main, /argv[\s\S]{0,260}--prepare-update[\s\S]{0,260}app\.quit\(\)/);
});
