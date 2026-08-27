import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../electron/main.mjs', import.meta.url), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = main.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  const brace = main.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < main.length; i += 1) {
    if (main[i] === '{') depth += 1;
    else if (main[i] === '}') {
      depth -= 1;
      if (depth === 0) return main.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

const source = [
  'const STRICT_MEDIA_SITE_SUFFIXES = ["animefire.io","animefire.net","animefire.plus","animesonlinecc.to","animesonline.cc","goyabu.io","anroll.plus","sushianimes.com.br","donghuanosekai.com"];',
  extractFunction('safeHttpUrl'),
  extractFunction('hostMatchesSuffix'),
  extractFunction('isStrictMediaSite'),
  extractFunction('sameWebOrigin'),
  extractFunction('isAllowedMediaFamilyTarget'),
  main.includes('function isGoogleSearchResultsUrl(') ? extractFunction('isGoogleSearchResultsUrl') : '',
  extractFunction('shouldOpenAsRequestedTab'),
  'return { shouldOpenAsRequestedTab };',
].join('\n');

const { shouldOpenAsRequestedTab } = new Function(source)();

test('Google search result using Chromium default disposition is allowed to leave Google', () => {
  assert.equal(
    shouldOpenAsRequestedTab(
      'https://www.google.com/search?q=marshmallow',
      'https://example.com/article',
      'default',
    ),
    true,
  );
});

test('ordinary automatic default cross-origin window.open remains blocked', () => {
  assert.equal(
    shouldOpenAsRequestedTab(
      'https://example.com/page',
      'https://tracker.invalid/popup',
      'default',
    ),
    false,
  );
});

test('Windows smoke gate explicitly validates Google result navigation', () => {
  const smoke = fs.readFileSync(new URL('../scripts/windows-smoke-5.0.ps1', import.meta.url), 'utf8');
  assert.match(smoke, /Google.*resultado.*link.*site externo/i);
});
