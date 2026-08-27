import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const VERSION = '5.0.1';
const SUPPORT_URLS = [
  'https://apoia.se/marshmallow-browser',
  'https://ko-fi.com/marshmallowbrowser',
  'https://buymeacoffee.com/marshmallowbrowser',
];
const OFFICIAL_ASSET = `https://github.com/blckbr/MarshMallow-Browser/releases/download/v${VERSION}/MarshMallow-Setup-${VERSION}.exe`;
const OFFICIAL_RELEASE = `https://github.com/blckbr/MarshMallow-Browser/releases/tag/v${VERSION}`;
const RELEASE_METADATA_URL = 'https://marshmallow-browser-br.pages.dev/download/release.json';
const failures = [];
const notes = [];

function fail(message) { failures.push(message); }
function pass(message) { console.log(`PASS ${message}`); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function expect(condition, message) { condition ? pass(message) : fail(message); }

const pkg = JSON.parse(read('package.json'));
const main = read('electron/main.mjs');
const preload = read('electron/preload.cjs');
const app = read('src/App.tsx');
const styles = read('src/styles.css');
const updateVerifier = read('electron/lib/update-verifier.mjs');
const installerNsis = read('build/installer.nsh');

expect(pkg.version === VERSION, `package.json version=${VERSION}`);
expect(new RegExp(`const VERSION\\s*=\\s*["']${VERSION.replaceAll('.', '\\.')}`).test(main), `main runtime version=${VERSION}`);
expect(new RegExp(`version:\\s*["']${VERSION.replaceAll('.', '\\.')}`).test(preload), `preload version=${VERSION}`);
expect(pkg.author === 'Deivison Santos (@devsaex)', 'creator attribution is Deivison Santos / @devsaex');
expect(pkg.build?.nsis?.include === 'build/installer.nsh', 'NSIS build uses MarshMallow custom installer lifecycle');
expect(installerNsis.includes('customCheckAppRunning') && installerNsis.includes('--prepare-update'), 'installer replaces raw running-app dialog with graceful MarshMallow shutdown flow');
expect(!installerNsis.includes('$(appRunning)') && !installerNsis.includes('$(appCannotBeClosed)'), 'installer does not reuse electron-builder raw running-app messages');
expect(main.includes('argv.includes("--prepare-update")') && main.includes('app.quit()'), 'running browser accepts graceful installer shutdown request');
expect(main.includes(RELEASE_METADATA_URL), 'browser update metadata uses official MarshMallow site');
expect(updateVerifier.includes('/blckbr/MarshMallow-Browser/releases/download/'), 'browser update validation is pinned to official GitHub repository');
expect(main.includes('sha256File'), 'downloaded updater is SHA-256 verified');
expect(main.includes('markTabDrmProtected') && main.includes('protected: true, drm: true'), 'DRM observation retroactively protects detected media');
expect(main.includes('mediaKeySystem'), 'protected-content playback permission is handled');
expect(!/nodeIntegration\s*:\s*true/.test(main), 'nodeIntegration is not globally enabled');
expect(!/contextIsolation\s*:\s*false/.test(main), 'contextIsolation is not globally disabled');
expect(!/webSecurity\s*:\s*false/.test(main), 'webSecurity is not globally disabled');
expect(!/allowRunningInsecureContent\s*:\s*true/.test(main), 'insecure content is not globally enabled');
expect(main.includes('browser:get-navigation-history') && main.includes('browser:go-navigation-index'), 'Back/Forward history exposes direct navigation-history IPC');
expect(/function focusAddressBar\s*\(\s*context\s*=\s*mainBrowserContext\s*\)/.test(main) && main.includes('targetWindow.webContents.focus()') && main.includes('sendToContextShell(context, "ui:focus-address")'), 'Ctrl+L transfers native keyboard focus to the owning browser chrome');
expect(app.includes('className="omnibox-suggestions"') && app.includes('className="nav-history-close"'), 'omnibox and navigation history are renderer-owned browser chrome');
expect(!/omniboxOverlayView|historyMenuView|__mmOmniboxRender|__mmHistoryRender/.test(main), 'navigation UI does not create auxiliary WebContents overlays');
expect(main.includes('classifyMediaObservation') && main.includes('onHeadersReceived'), 'media detector consumes network Content-Type metadata');
expect(main.includes('usesMediaSource'), 'MediaSource/blob detection is wired');
expect(main.includes('setBackgroundThrottling') && main.includes('resolveWindowBackgroundPolicy'), 'Game Scheduler controls background throttling');
expect(main.includes('getGPUFeatureStatus') && main.includes('getGPUInfo'), 'performance diagnostics report real GPU feature status');
expect(styles.includes('.toolbar {') && styles.includes('display:flex'), 'toolbar is constrained to a single flex row');
expect(styles.includes('.dock-open .browser-surface { margin-right:0 !important;'), 'renderer does not double-reserve native dock width');
expect(app.includes('Downloader de mídia') && app.includes('Modo Jogo') && app.includes('Extensões'), 'primary 5.0 toolbar tools are present');

for (const url of SUPPORT_URLS) {
  expect(main.includes(url) && app.includes(url), `support URL present exactly in browser: ${url}`);
}
expect(!/set(?:Timeout|Interval)\([^\n]{0,400}(?:apoia\.se|ko-fi\.com|buymeacoffee\.com)/i.test(`${main}\n${app}`), 'support integration has no automated nag timer');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git','.worktrees','node_modules','dist','release'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const secretPatterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const textExtensions = new Set(['.js','.mjs','.cjs','.ts','.tsx','.json','.md','.txt','.html','.css','.ps1','.bat','.toml','.yaml','.yml','.rs']);
for (const file of walk(ROOT)) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const rel = path.relative(ROOT, file);
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
  for (const pattern of secretPatterns) if (pattern.test(text)) fail(`possible secret pattern in ${rel}`);
}
if (!failures.some((x) => x.startsWith('possible secret pattern'))) pass('obvious secret-pattern scan');

const siteRoot = 'MarshMallow-Official-Website-5.0.1/site';
if (exists(siteRoot)) {
  const versionPath = `${siteRoot}/version.json`;
  expect(exists(versionPath), 'official site has version.json');
  if (exists(versionPath)) {
    const siteVersion = JSON.parse(read(versionPath));
    expect(siteVersion.version === VERSION, 'site version.json matches 5.0.1');
  }
  const supportPage = `${siteRoot}/apoie/index.html`;
  expect(exists(supportPage), 'official site has discreet support page');
  if (exists(supportPage)) {
    const supportHtml = read(supportPage);
    for (const url of SUPPORT_URLS) expect(supportHtml.includes(url), `site support page contains ${url}`);
  }
  const releasePath = `${siteRoot}/download/release.json`;
  expect(exists(releasePath), 'official site has release.json');
  if (exists(releasePath)) {
    const meta = JSON.parse(read(releasePath));
    expect(meta.version === VERSION, 'site release metadata version matches 5.0.1');
    if (meta.available === true) {
      expect(meta.url === OFFICIAL_ASSET, 'published installer URL is exact official GitHub asset');
      expect(meta.releaseUrl === OFFICIAL_RELEASE, 'published release URL is exact official GitHub release');
      expect(/^[a-f0-9]{64}$/i.test(String(meta.sha256 || '')), 'published metadata includes valid SHA-256');
      expect(Number(meta.size || 0) > 0, 'published metadata includes installer size');
    } else {
      notes.push('release.json is intentionally unavailable until the Windows installer passes runtime smoke tests.');
      pass('pre-publication release metadata is fail-closed (available=false)');
    }
  }
}

if (failures.length) {
  console.error('\nMarshMallow 5.0 source verification FAILED:');
  for (const item of failures) console.error(` - ${item}`);
  process.exit(1);
}
console.log(`\nMarshMallow ${VERSION} source verification PASSED.`);
for (const note of notes) console.log(`NOTE ${note}`);
