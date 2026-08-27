import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const main = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');
const preload = fs.readFileSync(new URL('../electron/preload.cjs', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../backend/src/index.js', import.meta.url), 'utf8');
const wrangler = fs.readFileSync(new URL('../backend/wrangler.jsonc', import.meta.url), 'utf8');
const siteCounter = fs.readFileSync(new URL('../MarshMallow-Official-Website-5.0.2/site/assets/download-count.js', import.meta.url), 'utf8');
const siteDownload = fs.readFileSync(new URL('../MarshMallow-Official-Website-5.0.2/site/assets/download.js', import.meta.url), 'utf8');
const publisher = fs.readFileSync(new URL('../scripts/windows-publish-5.0.2.ps1', import.meta.url), 'utf8');

const counter = await import('../backend/src/download-counter.js');

test('5.0.2 runtime metadata is consistent', () => {
  assert.equal(pkg.version, '5.0.2');
  assert.match(main, /const VERSION\s*=\s*["']5\.0\.2["']/);
  assert.match(preload, /version:\s*["']5\.0\.2["']/);
});

test('legacy GitHub installer counts seed only official Windows installers', () => {
  const releases = [
    { assets: [
      { name: 'MarshMallow-Setup-5.0.0.exe', download_count: 4 },
      { name: 'MarshMallow-Setup-5.0.0.exe.sha256.txt', download_count: 99 },
      { name: 'other.exe', download_count: 80 },
    ] },
    { assets: [{ name: 'MarshMallow-Setup-5.0.1.exe', download_count: 6 }] },
  ];
  assert.equal(counter.sumLegacyOfficialDownloads(releases), 10);
});

test('download counter recognizes likely bots and recent-count cookie', () => {
  assert.equal(counter.isLikelyBot('Googlebot/2.1 (+http://www.google.com/bot.html)'), true);
  assert.equal(counter.isLikelyBot('Mozilla/5.0 Chrome/150 Safari/537.36'), false);
  const now = 2_000_000;
  assert.equal(counter.shouldCountDownload({ method: 'GET', userAgent: 'Mozilla/5.0 Chrome/150 Safari/537.36', cookieHeader: `mm_dl_last=${now - 1000}`, now }), false);
  assert.equal(counter.shouldCountDownload({ method: 'GET', userAgent: 'Mozilla/5.0 Chrome/150 Safari/537.36', cookieHeader: '', now }), true);
  assert.equal(counter.shouldCountDownload({ method: 'HEAD', userAgent: 'Mozilla/5.0 Chrome/150 Safari/537.36', cookieHeader: '', now }), false);
});

test('Cloudflare Durable Object owns the persistent counter', () => {
  assert.match(wrangler, /"name"\s*:\s*"DOWNLOAD_COUNTER"/);
  assert.match(wrangler, /"class_name"\s*:\s*"DownloadCounter"/);
  assert.match(wrangler, /"new_sqlite_classes"\s*:\s*\[\s*"DownloadCounter"\s*\]/);
  assert.match(backend, /export class DownloadCounter extends DurableObject/);
  assert.match(backend, /url\.pathname === "\/api\/downloads\/count"/);
  assert.match(backend, /url\.pathname === "\/download\/windows"/);
});

test('site reads Cloudflare counter and routes installer clicks through tracked endpoint', () => {
  assert.match(siteCounter, /marshmallow-gateway\.marshmallow-browser-br\.workers\.dev\/api\/downloads\/count/);
  assert.doesNotMatch(siteCounter, /api\.github\.com\/repos\/blckbr\/MarshMallow-Browser\/releases/);
  assert.match(siteDownload, /marshmallow-gateway\.marshmallow-browser-br\.workers\.dev\/download\/windows/);
});

test('5.0.2 publisher never clobbers an existing release asset', () => {
  assert.doesNotMatch(publisher, /--clobber/);
  assert.match(publisher, /Release v5\.0\.2 ja existe/);
  assert.match(publisher, /backend:deploy|wrangler deploy/);
  assert.match(publisher, /MarshMallow-Official-Website-5\.0\.2/);
});

test('5.0.2 migration replaces the stale 5.0.1 pre-publication metadata assertion', () => {
  const apply = fs.readFileSync(new URL('../scripts/windows-apply-5.0.2.ps1', import.meta.url), 'utf8');
  const historicalPath = new URL('./release-5.0.1-site-counter.test.mjs', import.meta.url);
  assert.equal(fs.existsSync(historicalPath), true, '5.0.2 package must carry the migrated 5.0.1 historical test');
  assert.match(apply, /tests\\release-5\.0\.1-site-counter\.test\.mjs/);
  const historical = fs.readFileSync(historicalPath, 'utf8');
  assert.doesNotMatch(historical, /assert\.equal\(release\.available,\s*false\)/);
  assert.match(historical, /5\.0\.1 historical site metadata/);
  assert.match(historical, /releases\/download\/v5\.0\.1\/MarshMallow-Setup-5\.0\.1\.exe/);
});
