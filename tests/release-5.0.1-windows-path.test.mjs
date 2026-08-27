import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('5.0.1 release test resolves project root with a native Windows-safe path', () => {
  const source = read('tests/release-5.0.1-site-counter.test.mjs');
  assert.match(source, /path\.resolve\(import\.meta\.dirname, '\.\.'\)/);
  assert.doesNotMatch(source, /new URL\('\.\.', import\.meta\.url\)\.pathname/);
});

test('5.0.1 updater installs its root BAT as part of the guarded payload', () => {
  const source = read('scripts/windows-apply-5.0.1.ps1');
  assert.match(source, /'ATUALIZAR_MARSHMALLOW_5\.0\.1\.bat'/);
});
