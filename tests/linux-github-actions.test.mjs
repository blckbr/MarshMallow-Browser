import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const workflowUrl = new URL('../.github/workflows/build-linux.yml', import.meta.url);

function workflow() {
  return readFileSync(workflowUrl, 'utf8');
}

test('Linux GitHub Actions workflow exists and is manually runnable', () => {
  assert.equal(existsSync(workflowUrl), true, '.github/workflows/build-linux.yml missing');
  const text = workflow();
  assert.match(text, /workflow_dispatch\s*:/);
  assert.match(text, /branches:\s*\n\s*- ['\"]linux-rpm-5\.0\.2-\*['\"]/);
  assert.match(text, /runs-on:\s*ubuntu-24\.04/);
  assert.match(text, /actions\/checkout@v4/);
  assert.match(text, /actions\/setup-node@v4/);
  assert.match(text, /node-version:\s*['"]?24['"]?/);
});

test('Linux CI installs RPM and headless smoke-test prerequisites without weakening security', () => {
  const text = workflow();
  assert.match(text, /apt-get install[\s\S]*\brpm\b/);
  assert.match(text, /apt-get install[\s\S]*\bxvfb\b/);
  assert.match(text, /apt-get install[\s\S]*\bzip\b/);
  assert.match(text, /apt-get install[\s\S]*\bunzip\b/);
  assert.match(text, /apt-get install[\s\S]*\bxdg-utils\b/);
  assert.match(text, /apt-get install[\s\S]*\blibopenjp2-tools\b/);
  assert.doesNotMatch(text, /--no-sandbox/);
  assert.doesNotMatch(text, /setenforce|SELINUX=disabled/i);
});

test('Linux CI verifies source before building RPM and AppImage', () => {
  const text = workflow();
  assert.match(text, /npm ci --no-audit --no-fund/);
  assert.match(text, /scripts\/linux\/verify-linux\.sh/);
  assert.match(text, /scripts\/linux\/build-rpm\.sh/);
  assert.match(text, /scripts\/linux\/build-appimage\.sh/);
  assert.match(text, /electron-builder --linux dir --x64/);
  assert.match(text, /scripts\/linux\/smoke-linux\.sh/);
});

test('Linux CI generates hashes, validation report and uploads the exact release artifacts', () => {
  const text = workflow();
  assert.match(text, /SHA256SUMS\.txt/);
  assert.match(text, /RELATORIO-VALIDACAO-LINUX\.txt/);
  assert.match(text, /MarshMallow-Browser-5\.0\.2-x86_64\.rpm/);
  assert.match(text, /MarshMallow-Browser-5\.0\.2-x86_64\.AppImage/);
  assert.match(text, /actions\/upload-artifact@v4/);
  assert.match(text, /if-no-files-found:\s*error/);
});

test('Linux validation report obtains package versions with shell-safe assignments', () => {
  const text = workflow();
  assert.doesNotMatch(text, /node -p \\\"require/);
  assert.match(text, /ELECTRON_VERSION=\$\(node -p "require\('\.\/package\.json'\)\.devDependencies\.electron"\)/);
  assert.match(text, /BUILDER_VERSION=\$\(node -p "require\('\.\/package\.json'\)\.devDependencies\['electron-builder'\]"\)/);
  assert.match(text, /echo "Electron: \$ELECTRON_VERSION"/);
  assert.match(text, /echo "electron-builder: \$BUILDER_VERSION"/);
});
