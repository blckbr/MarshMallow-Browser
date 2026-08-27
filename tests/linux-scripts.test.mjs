import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';

const files = [
  'scripts/linux/verify-linux.sh',
  'scripts/linux/build-rpm.sh',
  'scripts/linux/build-appimage.sh',
  'scripts/linux/smoke-linux.sh',
  'BUILD_MARSHMALLOW_LINUX.sh',
];

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Linux release scripts are strict, portable and never weaken sandbox or SELinux', () => {
  for (const path of files) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `${path} missing`);
    const text = read(path);
    assert.match(text, /^#!\/usr\/bin\/env bash/m, `${path} must use bash env shebang`);
    assert.match(text, /set -euo pipefail/, `${path} must fail closed`);
    assert.doesNotMatch(text, /--no-sandbox/);
    assert.doesNotMatch(text, /setenforce|SELINUX=disabled|sudo\s+/i);
    assert.doesNotMatch(text, /[A-Za-z]:\\/);
  }
});

test('verify-linux validates source, Linux tools, types and web build', () => {
  const text = read('scripts/linux/verify-linux.sh');
  assert.match(text, /uname -s/);
  for (const tool of ['node', 'npm', 'unzip', 'zip', 'xdg-mime', 'xdg-settings']) assert.match(text, new RegExp(`require_command ["']?${tool}`));
  assert.match(text, /npm run test:unit/);
  assert.match(text, /node --check electron\/main\.mjs/);
  assert.match(text, /node --check electron\/preload\.cjs/);
  assert.match(text, /npm run typecheck/);
  assert.match(text, /npm run build:web/);
});

test('build scripts use isolated electron-builder Linux targets and normalize artifacts', () => {
  const rpm = read('scripts/linux/build-rpm.sh');
  const appImage = read('scripts/linux/build-appimage.sh');
  assert.match(rpm, /npm run dist:linux:rpm/);
  assert.match(rpm, /MarshMallow-Browser-5\.0\.2-x86_64\.rpm/);
  assert.match(appImage, /npm run dist:linux:appimage/);
  assert.match(appImage, /MarshMallow-Browser-5\.0\.2-x86_64\.AppImage/);
  assert.match(rpm, /release-linux/);
  assert.match(appImage, /release-linux/);
});

test('smoke script uses real Linux runtime with display isolation and no root/sandbox shortcut', () => {
  const text = read('scripts/linux/smoke-linux.sh');
  assert.match(text, /linux-unpacked\/marshmallow-browser/);
  assert.match(text, /xvfb-run/);
  assert.match(text, /EUID/);
  assert.match(text, /runuser/);
  assert.match(text, /XDG_CONFIG_HOME/);
  assert.match(text, /XDG_CACHE_HOME/);
  assert.match(text, /timeout/);
});

test('root Linux build launcher runs RPM and AppImage pipelines', () => {
  const text = read('BUILD_MARSHMALLOW_LINUX.sh');
  assert.match(text, /build-appimage\.sh/);
  assert.match(text, /build-rpm\.sh/);
});
