import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const ps1 = fs.readFileSync(path.join(root, 'scripts', 'windows-republish-site-seo-5.0.ps1'), 'utf8');
const home = fs.readFileSync(path.join(root, 'MarshMallow-Official-Website-5.0.0', 'site', 'index.html'), 'utf8');

test('public-home verifier does not depend on non-ASCII punctuation', () => {
  assert.doesNotMatch(ps1, /MarshMallow Browser — navegador gratuito para Windows/);
  assert.match(ps1, /<title>MarshMallow Browser/);
  assert.match(ps1, /og:site_name/);
  assert.match(ps1, /BrowserApplication/);
});

test('ASCII structural markers survive a mojibake-style decode', () => {
  const broken = Buffer.from(home, 'utf8').toString('latin1');
  assert.doesNotMatch(broken, /MarshMallow Browser — navegador gratuito para Windows/);
  assert.match(broken, /<title>MarshMallow Browser/);
  assert.match(broken, /og:site_name/);
  assert.match(broken, /BrowserApplication/);
});

test('verification-only helper exists and cannot deploy or mutate GitHub', () => {
  const confirmPath = path.join(root, 'scripts', 'windows-confirm-site-seo-5.0.ps1');
  assert.equal(fs.existsSync(confirmPath), true, 'missing verification-only helper');
  const confirm = fs.readFileSync(confirmPath, 'utf8');
  assert.doesNotMatch(confirm, /wrangler\s+pages\s+deploy/i);
  assert.doesNotMatch(confirm, /gh\.exe\s+(release|api|repo|workflow)/i);
  assert.match(confirm, /<title>MarshMallow Browser/);
  assert.match(confirm, /BrowserApplication/);
  assert.match(confirm, /sitemap\.xml/);
  assert.match(confirm, /seguranca\//);
});
