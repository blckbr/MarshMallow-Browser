import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('MarshMallow-Official-Website-5.0.0/site');
const base = 'https://marshmallow-browser-br.pages.dev';
const publicPages = [
  ['/', 'index.html'],
  ['/recursos/', 'recursos/index.html'],
  ['/download/', 'download/index.html'],
  ['/changelog/', 'changelog/index.html'],
  ['/privacidade/', 'privacidade/index.html'],
  ['/seguranca/', 'seguranca/index.html'],
  ['/criador/', 'criador/index.html'],
  ['/apoie/', 'apoie/index.html'],
  ['/en/', 'en/index.html'],
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function attr(html, tag, attrName, attrValue, wanted) {
  const re = new RegExp(`<${tag}\\b[^>]*${attrName}=["']${attrValue.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  const match = html.match(re);
  if (!match) return null;
  const valueMatch = match[0].match(new RegExp(`${wanted}=["']([^"']+)["']`, 'i'));
  return valueMatch?.[1] ?? null;
}

function linkHref(html, rel, hreflang = null) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const link of links) {
    if (!new RegExp(`\\brel=["'][^"']*\\b${rel}\\b[^"']*["']`, 'i').test(link)) continue;
    if (hreflang && !new RegExp(`\\bhreflang=["']${hreflang}["']`, 'i').test(link)) continue;
    return link.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? null;
  }
  return null;
}

function meta(html, key, value) {
  return attr(html, 'meta', key, value, 'content');
}

function canonicalFor(route) {
  return `${base}${route}`;
}

test('all public pages expose complete index and sharing metadata', () => {
  const titles = new Set();
  const descriptions = new Set();

  for (const [route, rel] of publicPages) {
    const html = read(rel);
    const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = meta(html, 'name', 'description');
    const robots = meta(html, 'name', 'robots');
    const canonical = linkHref(html, 'canonical');

    assert.ok(title, `${rel}: missing title`);
    assert.ok(description, `${rel}: missing description`);
    assert.ok(robots?.includes('index') && robots?.includes('follow'), `${rel}: must be index,follow`);
    assert.equal(canonical, canonicalFor(route), `${rel}: wrong canonical`);
    assert.equal(meta(html, 'property', 'og:site_name'), 'MarshMallow Browser', `${rel}: missing og:site_name`);
    assert.ok(meta(html, 'property', 'og:title'), `${rel}: missing og:title`);
    assert.ok(meta(html, 'property', 'og:description'), `${rel}: missing og:description`);
    assert.equal(meta(html, 'property', 'og:url'), canonicalFor(route), `${rel}: wrong og:url`);
    assert.ok(meta(html, 'property', 'og:image'), `${rel}: missing og:image`);
    assert.equal(meta(html, 'name', 'twitter:card'), 'summary_large_image', `${rel}: missing twitter card`);
    assert.ok(meta(html, 'name', 'twitter:title'), `${rel}: missing twitter:title`);
    assert.ok(meta(html, 'name', 'twitter:description'), `${rel}: missing twitter:description`);
    assert.ok(meta(html, 'name', 'twitter:image'), `${rel}: missing twitter:image`);

    assert.ok(!titles.has(title), `${rel}: duplicate title ${title}`);
    assert.ok(!descriptions.has(description), `${rel}: duplicate description`);
    titles.add(title);
    descriptions.add(description);
  }
});

test('home page supplies strong brand and software signals for Google', () => {
  const html = read('index.html');
  assert.match(html, /<title>MarshMallow Browser — navegador gratuito para Windows<\/title>/i);
  assert.match(html, /<h1[^>]*>[^<]*MarshMallow Browser/i);
  assert.equal(linkHref(html, 'icon'), '/assets/icon-192.png');

  const scripts = [...html.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length, 'home: missing JSON-LD');
  const graph = JSON.parse(scripts[0][1])['@graph'];
  const website = graph.find((item) => item['@type'] === 'WebSite');
  const app = graph.find((item) => item['@type'] === 'SoftwareApplication');
  assert.equal(website.name, 'MarshMallow Browser');
  assert.ok(website.alternateName.includes('marshmallow-browser-br.pages.dev'));
  assert.equal(app.applicationCategory, 'BrowserApplication');
  assert.equal(String(app.offers.price), '0');
  assert.equal(app.offers.priceCurrency, 'BRL');
  assert.ok(app.sameAs.includes('https://github.com/blckbr/MarshMallow-Browser'));
});

test('Portuguese and English home pages declare reciprocal hreflang and x-default', () => {
  for (const rel of ['index.html', 'en/index.html']) {
    const html = read(rel);
    assert.equal(linkHref(html, 'alternate', 'pt-BR'), `${base}/`, `${rel}: pt-BR hreflang`);
    assert.equal(linkHref(html, 'alternate', 'en'), `${base}/en/`, `${rel}: en hreflang`);
    assert.equal(linkHref(html, 'alternate', 'x-default'), `${base}/`, `${rel}: x-default hreflang`);
  }
});

test('security page exists, is linked and documents official release verification', () => {
  const security = read('seguranca/index.html');
  assert.match(security, /SHA-256/i);
  assert.match(security, /Chromium/i);
  assert.match(security, /github\.com\/blckbr\/MarshMallow-Browser/i);

  for (const rel of ['index.html', 'recursos/index.html', 'download/index.html', 'privacidade/index.html']) {
    assert.match(read(rel), /href=["']\/seguranca\//i, `${rel}: missing security link`);
  }
});

test('sitemap contains every indexable page using meaningful lastmod only', () => {
  const xml = read('sitemap.xml');
  assert.doesNotMatch(xml, /<priority>/i);
  assert.doesNotMatch(xml, /<changefreq>/i);
  for (const [route] of publicPages) {
    assert.match(xml, new RegExp(`<loc>${canonicalFor(route).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}<\\/loc>`));
  }
  assert.match(xml, /<lastmod>2026-08-23<\/lastmod>/);
});

test('robots.txt exposes the canonical sitemap and does not block crawling', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.match(robots, new RegExp(`Sitemap:\\s*${base.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\/sitemap\\.xml`, 'i'));
  assert.doesNotMatch(robots, /Disallow:\s*\//i);
});


test('SEO-only publisher gates deployment and validates the public Google endpoints', () => {
  const ps1Path = path.resolve('scripts/windows-republish-site-seo-5.0.ps1');
  const batPath = path.resolve('REPUBLICAR_SITE_SEO_GOOGLE_5.0.0.bat');
  assert.ok(fs.existsSync(ps1Path), 'missing SEO-only PowerShell publisher');
  assert.ok(fs.existsSync(batPath), 'missing SEO-only BAT launcher');

  const ps1 = fs.readFileSync(ps1Path, 'utf8');
  assert.match(ps1, /node(?:\.exe)?[^\r\n]*--test[^\r\n]*site-seo\.test\.mjs/i, 'publisher must run SEO tests before deploy');
  assert.match(ps1, /wrangler[^\r\n]*pages[^\r\n]*deploy/i, 'publisher must deploy only Cloudflare Pages');
  assert.match(ps1, /robots\.txt/i);
  assert.match(ps1, /sitemap\.xml/i);
  assert.match(ps1, /seguranca\//i);
  assert.match(ps1, /googlecb101239684b3450\.html/i);
  assert.doesNotMatch(ps1, /cargo\s+(build|tauri)/i, 'SEO publisher must not rebuild the browser');
  assert.doesNotMatch(ps1, /gh\s+release\s+(create|upload)/i, 'SEO publisher must not modify GitHub releases');
});
