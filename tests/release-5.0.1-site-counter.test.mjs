import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const site = 'MarshMallow-Official-Website-5.0.1/site';
const pub = 'MarshMallow-GitHub-Public-5.0.1';

test('5.0.1 release website and launchers exist', () => {
  for (const rel of [
    `${site}/index.html`, `${site}/download/index.html`, `${site}/recursos/index.html`, `${site}/changelog/index.html`,
    `${site}/assets/download-count.js`, `${site}/download/release.json`, `${site}/version.json`,
    `${pub}/5.0.1.md`, `${pub}/releases/5.0.1.md`,
    'VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.1.bat', 'REGISTRAR_SMOKE_5.0.1.bat', 'PUBLICAR_MARSHMALLOW_5.0.1.bat',
    'scripts/windows-build-5.0.1.ps1', 'scripts/windows-smoke-5.0.1.ps1', 'scripts/windows-publish-5.0.1.ps1',
    'scripts/verify-5.0.1.mjs', 'scripts/windows-apply-5.0.1.ps1', 'ATUALIZAR_MARSHMALLOW_5.0.1.bat',
  ]) assert.equal(exists(rel), true, rel);
});

test('site counter is cumulative, official-installer-only, cached and non-blocking', async () => {
  assert.equal(exists(`${site}/assets/download-count.js`), true);
  if (!exists(`${site}/assets/download-count.js`)) return;
  const moduleUrl = `${pathToFileURL(path.join(root, site, 'assets/download-count.js')).href}?t=${Date.now()}`;
  const mod = await import(moduleUrl);
  assert.equal(typeof mod.sumOfficialDownloads, 'function');
  const total = mod.sumOfficialDownloads([
    { assets: [
      { name: 'MarshMallow-Setup-5.0.0.exe', download_count: 17 },
      { name: 'MarshMallow-Setup-5.0.0.exe.sha256.txt', download_count: 999 },
      { name: 'MarshMallow-Setup-5.0.0.exe.blockmap', download_count: 999 },
    ]},
    { assets: [
      { name: 'MarshMallow-Setup-5.0.1.exe', download_count: 23 },
      { name: 'other.exe', download_count: 500 },
    ]},
  ]);
  assert.equal(total, 40);
  const script = read(`${site}/assets/download-count.js`);
  assert.match(script, /api\.github\.com\/repos\/blckbr\/MarshMallow-Browser\/releases/);
  assert.match(script, /localStorage/);
  assert.match(script, /15\s*\*\s*60\s*\*\s*1000/);
  assert.match(script, /catch/);
});

test('home and download pages expose the neon cumulative counter without replacing the download button', () => {
  assert.equal(exists(`${site}/index.html`), true);
  assert.equal(exists(`${site}/download/index.html`), true);
  assert.equal(exists(`${site}/assets/styles.css`), true);
  if (!exists(`${site}/index.html`) || !exists(`${site}/download/index.html`) || !exists(`${site}/assets/styles.css`)) return;
  const home = read(`${site}/index.html`);
  const download = read(`${site}/download/index.html`);
  const css = read(`${site}/assets/styles.css`);
  for (const html of [home, download]) {
    assert.match(html, /data-download-counter/);
    assert.match(html, /download-count\.js/);
  }
  assert.match(download, /id="download-button"/);
  assert.match(css, /\.download-counter/);
  assert.match(css, /text-shadow/);
  assert.match(css, /#ff/i);
  const headers = read(`${site}/_headers`);
  assert.match(headers, /connect-src[^\n]*https:\/\/api\.github\.com/);
});

test('5.0.1 website and public notes advertise PDF Reader only, not PDF editing', () => {
  for (const rel of [`${site}/index.html`, `${site}/recursos/index.html`, `${site}/changelog/index.html`, `${pub}/5.0.1.md`]) assert.equal(exists(rel), true, rel);
  if (![`${site}/index.html`, `${site}/recursos/index.html`, `${site}/changelog/index.html`, `${pub}/5.0.1.md`].every(exists)) return;
  const home = read(`${site}/index.html`);
  const resources = read(`${site}/recursos/index.html`);
  const changelog = read(`${site}/changelog/index.html`);
  const notes = read(`${pub}/5.0.1.md`);
  const combined = `${home}\n${resources}\n${changelog}\n${notes}`;
  assert.match(combined, /PDF Reader/);
  assert.match(combined, /PDF\.js|PDF.js/);
  assert.doesNotMatch(combined, /PDF Reader\s*\/\s*Editor|PDF Editor|editar PDFs|edição de PDF/i);
});

test('5.0.1 historical site metadata remains versioned and valid after publication', () => {
  assert.equal(exists(`${site}/version.json`), true);
  assert.equal(exists(`${site}/download/release.json`), true);
  if (!exists(`${site}/version.json`) || !exists(`${site}/download/release.json`)) return;
  const version = JSON.parse(read(`${site}/version.json`));
  const release = JSON.parse(read(`${site}/download/release.json`));
  assert.equal(version.version, '5.0.1');
  assert.equal(release.version, '5.0.1');
  assert.equal(typeof release.available, 'boolean');
  if (release.available) {
    assert.equal(release.url, 'https://github.com/blckbr/MarshMallow-Browser/releases/download/v5.0.1/MarshMallow-Setup-5.0.1.exe');
    assert.equal(release.releaseUrl, 'https://github.com/blckbr/MarshMallow-Browser/releases/tag/v5.0.1');
    assert.match(String(release.sha256 || ''), /^[a-f0-9]{64}$/i);
    assert.ok(Number(release.size || release.sizeBytes || 0) > 0);
  }
});

test('5.0.1 smoke and publisher gate the exact installer and include PDF Reader runtime coverage', () => {
  for (const rel of ['scripts/windows-build-5.0.1.ps1','scripts/windows-smoke-5.0.1.ps1','scripts/windows-publish-5.0.1.ps1']) assert.equal(exists(rel), true, rel);
  if (!['scripts/windows-build-5.0.1.ps1','scripts/windows-smoke-5.0.1.ps1','scripts/windows-publish-5.0.1.ps1'].every(exists)) return;
  const build = read('scripts/windows-build-5.0.1.ps1');
  const smoke = read('scripts/windows-smoke-5.0.1.ps1');
  const publish = read('scripts/windows-publish-5.0.1.ps1');
  assert.match(build, /MarshMallow-Setup-\$Version\.exe/);
  assert.match(build, /BUILD_VALIDATION_5\.0\.1\.json/);
  assert.match(smoke, /RUNTIME_SMOKE_5\.0\.1_PASS\.json/);
  assert.match(smoke, /PDF Reader/);
  assert.match(smoke, /arquivo PDF local/i);
  assert.match(smoke, /PDF.*web/i);
  assert.match(publish, /BUILD_VALIDATION_5\.0\.1\.json/);
  assert.match(publish, /RUNTIME_SMOKE_5\.0\.1_PASS\.json/);
  assert.match(publish, /v\$Version/);
  assert.match(publish, /MarshMallow-GitHub-Public-5\.0\.1/);
  assert.match(publish, /MarshMallow-Official-Website-5\.0\.1/);
  assert.match(publish, /wrangler pages deploy/);
  assert.match(publish, /sha256/);
});


test('5.0.1 updater is guarded by backup rollback and verification', () => {
  assert.equal(exists('scripts/windows-apply-5.0.1.ps1'), true);
  assert.equal(exists('ATUALIZAR_MARSHMALLOW_5.0.1.bat'), true);
  if (!exists('scripts/windows-apply-5.0.1.ps1') || !exists('ATUALIZAR_MARSHMALLOW_5.0.1.bat')) return;
  const ps1 = read('scripts/windows-apply-5.0.1.ps1');
  const bat = read('ATUALIZAR_MARSHMALLOW_5.0.1.bat');
  assert.match(ps1, /backup/i);
  assert.match(ps1, /rollback/i);
  assert.match(ps1, /npm\.cmd run test:unit/);
  assert.match(ps1, /npm\.cmd run typecheck/);
  assert.match(ps1, /npm\.cmd run build/);
  assert.match(bat, /MarshMallow-5\.0\.1-Source-Publicacao\.zip/);
});
