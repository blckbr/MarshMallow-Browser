import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const publisher = readFileSync(new URL('scripts/windows-publish-5.0.ps1', root), 'utf8');
const verifier = readFileSync(new URL('scripts/windows-verify-publication-5.0.ps1', root), 'utf8');
const repairBat = new URL('REPUBLICAR_SITE_5.0.0.bat', root);
const repairPs1 = new URL('scripts/windows-republish-site-5.0.ps1', root);

test('site metadata is written as UTF-8 without BOM', () => {
  assert.match(publisher, /UTF8Encoding\s*\(\s*\$false\s*\)/i);
  assert.match(publisher, /WriteAllText\s*\(\s*\$ReleaseJson/i);
  assert.match(publisher, /WriteAllText\s*\(\s*\$VersionJson/i);
  assert.doesNotMatch(publisher, /Set-Content\s+-LiteralPath\s+\$ReleaseJson\s+-Encoding\s+UTF8/i);
  assert.doesNotMatch(publisher, /Set-Content\s+-LiteralPath\s+\$VersionJson\s+-Encoding\s+UTF8/i);
});

test('public JSON parser tolerates UTF-8 BOM and mojibake BOM', () => {
  for (const source of [publisher, verifier]) {
    assert.match(source, /function\s+Convert-PublishedJson\b/i);
    assert.match(source, /0xFEFF/i);
    assert.match(source, /0x00EF/i);
    assert.match(source, /0x00BB/i);
    assert.match(source, /0x00BF/i);
  }
});

test('site-only repair launcher exists and does not upload GitHub release assets', () => {
  assert.equal(existsSync(repairBat), true);
  assert.equal(existsSync(repairPs1), true);
  const bat = readFileSync(repairBat, 'utf8');
  const ps1 = readFileSync(repairPs1, 'utf8');
  assert.match(bat, /windows-republish-site-5\.0\.ps1/i);
  assert.match(ps1, /wrangler pages deploy/i);
  assert.match(ps1, /UTF8Encoding\s*\(\s*\$false\s*\)/i);
  assert.doesNotMatch(ps1, /gh\.exe release upload/i);
  assert.doesNotMatch(ps1, /gh\.exe release create/i);
  assert.doesNotMatch(ps1, /git\.exe push/i);
});
