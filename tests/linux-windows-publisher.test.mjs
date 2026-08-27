import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const batUrl = new URL('PUBLICAR_E_COMPILAR_MARSHMALLOW_LINUX_GITHUB.bat', root);
const psUrl = new URL('scripts/windows-publish-linux-ci-5.0.2.ps1', root);

function read(url) {
  return readFileSync(url, 'utf8');
}

test('Windows launcher exists and delegates Linux CI publishing to PowerShell', () => {
  assert.equal(existsSync(batUrl), true, 'Linux GitHub publisher BAT missing');
  assert.equal(existsSync(psUrl), true, 'Linux GitHub publisher PowerShell missing');
  const bat = read(batUrl);
  assert.match(bat, /windows-publish-linux-ci-5\.0\.2\.ps1/i);
  assert.match(bat, /-ExecutionPolicy Bypass/i);
});

test('publisher targets only the official repository and an isolated CI branch', () => {
  const ps = read(psUrl);
  assert.match(ps, /\$Repo\s*=\s*['"]blckbr\/MarshMallow-Browser['"]/);
  assert.match(ps, /linux-rpm-5\.0\.2-ci-/);
  assert.match(ps, /defaultBranchRef/);
  assert.match(ps, /git\.exe['"]?\s+checkout[\s\S]*-b/);
  assert.match(ps, /git\.exe['"]?\s+push/);
  assert.doesNotMatch(ps, /push[\s\S]{0,120}HEAD:main/i);
  assert.doesNotMatch(ps, /--force/);
  assert.doesNotMatch(ps, /release create/i);
});

test('publisher authenticates with gh, waits for Actions and downloads validated Linux artifacts', () => {
  const ps = read(psUrl);
  assert.match(ps, /gh\.exe['"]?\s+auth\s+status/);
  assert.match(ps, /gh\.exe['"]?\s+run\s+list[\s\S]{0,180}--event\s+push/);
  assert.doesNotMatch(ps, /gh\.exe['"]?\s+run\s+list[^\r\n]*--workflow/);
  assert.match(ps, /gh\.exe['"]?\s+run\s+watch/);
  assert.match(ps, /gh\.exe['"]?\s+run\s+download/);
  assert.match(ps, /MarshMallow-Browser-5\.0\.2-x86_64\.rpm/);
  assert.match(ps, /MarshMallow-Browser-5\.0\.2-x86_64\.AppImage/);
  assert.match(ps, /SHA256SUMS\.txt/);
  assert.match(ps, /Get-FileHash/);
});

test('publisher mirrors source while excluding local build and dependency directories', () => {
  const ps = read(psUrl);
  for (const name of ['.git', 'node_modules', 'release', 'release-linux', '.worktrees']) {
    assert.match(ps, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(ps, /git\.exe['"]?\s+add\s+-A/);
  assert.match(ps, /git\.exe['"]?\s+commit/);
});
