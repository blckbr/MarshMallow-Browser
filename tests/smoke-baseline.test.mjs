import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package exposes the 5.0 unit-test command', () => {
  assert.equal(pkg.scripts['test:unit'], 'node --test tests/*.test.mjs');
});
