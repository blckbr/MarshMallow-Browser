import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const desktopPath = new URL('../build/linux/com.devsaex.marshmallow.desktop', import.meta.url);

test('package declares isolated RPM and AppImage build targets', () => {
  assert.equal(pkg.desktopName, 'com.devsaex.marshmallow');
  assert.equal(pkg.build.appId, 'com.devsaex.marshmallow');
  assert.equal(pkg.build.linux.executableName, 'marshmallow-browser');
  assert.deepEqual(pkg.build.linux.target, ['rpm', 'AppImage']);
  assert.equal(pkg.build.linux.icon, 'build/icons');
  assert.equal(pkg.build.linux.syncDesktopName, true);
  assert.equal(pkg.build.linux.artifactName, 'MarshMallow-Browser-${version}-${arch}.${ext}');
  assert.match(pkg.scripts['dist:linux'], /electron-builder --linux rpm AppImage --x64/);
  assert.match(pkg.scripts['dist:linux'], /release-linux/);
  assert.match(pkg.scripts['dist:linux:rpm'], /--linux rpm --x64/);
  assert.match(pkg.scripts['dist:linux:appimage'], /--linux AppImage --x64/);
});

test('RPM declares Red Hat-family runtime tooling needed by MarshMallow', () => {
  const deps = pkg.build.rpm.depends;
  for (const dep of ['gtk3', 'nss', 'xdg-utils', 'unzip', 'zip']) assert.ok(deps.includes(dep), `missing ${dep}`);
});

test('Linux desktop integration registers web and MarshMallow URL schemes', () => {
  assert.equal(existsSync(desktopPath), true);
  const desktop = readFileSync(desktopPath, 'utf8');
  assert.match(desktop, /^Name=MarshMallow Browser$/m);
  assert.match(desktop, /^Exec=marshmallow-browser %U$/m);
  assert.match(desktop, /^Icon=com\.devsaex\.marshmallow$/m);
  assert.match(desktop, /^Categories=Network;WebBrowser;$/m);
  assert.match(desktop, /^MimeType=.*x-scheme-handler\/http;.*x-scheme-handler\/https;.*x-scheme-handler\/marshmallow;/m);
  assert.match(desktop, /^StartupWMClass=com\.devsaex\.marshmallow$/m);

  const entry = pkg.build.linux.desktop.entry;
  assert.equal(entry.Name, 'MarshMallow Browser');
  assert.equal(entry.StartupWMClass, 'com.devsaex.marshmallow');
  assert.match(entry.MimeType, /x-scheme-handler\/http/);
  assert.ok(pkg.build.protocols.some((item) => item.schemes?.includes('marshmallow')));
});

test('Linux icon set contains the freedesktop sizes used by electron-builder', () => {
  for (const size of [16, 24, 32, 48, 64, 96, 128, 256, 512]) {
    assert.equal(existsSync(new URL(`../build/icons/${size}x${size}.png`, import.meta.url)), true, `${size} icon missing`);
  }
});
