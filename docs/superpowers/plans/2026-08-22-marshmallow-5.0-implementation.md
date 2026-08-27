# MarshMallow 5.0.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship MarshMallow 5.0.0 as a verified Windows release with browser-grade history navigation, reliable omnibox/autocomplete, a safe modern browser-game mode, corrected dock geometry, improved media detection/download UX, discreet support links, and consistent GitHub/site update metadata.

**Architecture:** Keep Electron 43 + `WebContentsView` and split the new logic into small pure modules under `electron/lib/` plus focused renderer helpers under `src/lib/`. The main process remains authoritative for native view geometry, navigation history, game/runtime policy, media network observations, downloads, permissions, update verification and internal pages; React owns presentation and user interaction. Pure policy/geometry/classification logic is tested with Node's built-in test runner so core regressions can be verified without launching Electron.

**Tech Stack:** Electron 43.4.1, Chromium 150, React 19, TypeScript 5.9, Vite 8, Node 22/24 compatible ESM, Node `node:test`, electron-builder/NSIS, FFmpeg when locally available, Cloudflare Pages, GitHub Releases.

**Spec:** `docs/superpowers/specs/2026-08-22-marshmallow-5.0-design.md`

## Global Constraints

- Final application/site/release version is exactly `5.0.0`.
- Final release title is exactly `MarshMallow 5.0.0`.
- Creator/developer attribution is `Deivison Santos` / `@devsaex` only.
- Preserve the Black Piano identity while reorganizing the toolbar responsively.
- Keep Electron context isolation/security boundaries; do not globally weaken sandbox or web security for Game Mode.
- Do not add Flash support, DRM circumvention, silent self-update, blanket permission grants, or intrusive support prompts.
- Support links are exactly: `https://apoia.se/marshmallow-browser`, `https://ko-fi.com/marshmallowbrowser`, `https://buymeacoffee.com/marshmallowbrowser`.
- Publication is blocked unless automated checks and required Windows runtime smoke checks pass.
- Do not publish `.env*`, authentication material, tokens, cookies, or other private local state.

---

## File Structure

**New pure main-process modules**

- `electron/lib/geometry.mjs` — deterministic shell/page/dock/omnibox bounds.
- `electron/lib/navigation-history.mjs` — normalize and slice Electron navigationHistory entries for UI.
- `electron/lib/game-mode.mjs` — per-domain Game Mode state, auto-signal scoring, background-policy resolution.
- `electron/lib/media-detection.mjs` — classify MIME/URL/request observations, deduplicate adaptive traffic, expose useful labels.
- `electron/lib/update-verifier.mjs` — version comparison, release metadata validation and SHA-256 verification.

**New renderer helpers**

- `src/lib/omnibox.ts` — candidate scoring/building previously embedded in `App.tsx`.
- `src/lib/domainSettings.ts` — local persisted per-domain Game Mode settings schema.

**New tests**

- `tests/geometry.test.mjs`
- `tests/navigation-history.test.mjs`
- `tests/game-mode.test.mjs`
- `tests/media-detection.test.mjs`
- `tests/update-verifier.test.mjs`
- `tests/omnibox-model.test.mjs` (imports an ESM mirror exported for tests from `electron/lib/omnibox-model.mjs`; renderer `src/lib/omnibox.ts` is kept behaviorally identical and typechecked by TS)

**Existing core files modified**

- `electron/main.mjs` — integrate pure modules, dock manager, history IPC/menu, Game Scheduler, media request correlation, update/internal pages, support/performance pages.
- `electron/preload.cjs` — expose new typed IPC surface.
- `electron/omnibox-preload.cjs` — explicit `ready` handshake before first state replay.
- `src/App.tsx` — toolbar/history interactions, dock selection, Game Mode UI, support entry, media UX, About/update UI.
- `src/styles.css` — single-row toolbar, shared dock, history menu styling, media cards, Game Mode controls, responsive behavior.
- `src/types.ts` — 5.0 IPC/data types.
- `package.json` — version 5.0.0 and test/verification scripts.
- `README_4.1.0.md` / new `README_5.0.0.md`, `MARSHMALLOW_CREATOR.txt` if version wording is present.

**Release/site assets created or updated**

- `5.0.0.md`
- `releases/5.0.0.md`
- `site/index.html`, `site/recursos/index.html`, `site/apoie/index.html`, `site/download/release.json`, `site/version.json` in the 5.0 release kit.
- `scripts/verify-5.0.mjs` — automated source/release invariants.
- `PUBLICAR_MARSHMALLOW_5.0.0.bat` — Windows build + smoke gate + GitHub/site publication with loud failures.
- `DIAGNOSTICAR_MARSHMALLOW_5.0.0.bat` — read-only post-publication checks.

---

### Task 1: Establish a safe 4.1.0 baseline and verification harness

**Files:**
- Create: `.gitignore`
- Create: `tests/smoke-baseline.test.mjs`
- Modify: `package.json`
- Commit baseline source after excluding local secrets/state.

**Interfaces:**
- Produces: `npm run test:unit` using `node --test tests/*.test.mjs`.
- Produces: `npm run verify:source` placeholder target initially mapped to unit tests + syntax checks, expanded in Task 10.

- [ ] **Step 1: Add secret/local-state exclusions before staging source**

```gitignore
node_modules/
dist/
release/
.env
.env.*
!.env.example
.watch_backend_url
*.log
*.tmp
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Write a failing baseline package test**

```js
// tests/smoke-baseline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('package exposes the 5.0 unit-test command', () => {
  assert.equal(pkg.scripts['test:unit'], 'node --test tests/*.test.mjs');
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `node --test tests/smoke-baseline.test.mjs`
Expected: FAIL because `test:unit` is not defined.

- [ ] **Step 4: Add test scripts without changing the app version yet**

```json
"test:unit": "node --test tests/*.test.mjs",
"verify:source": "npm run test:unit && node --check electron/main.mjs && node --check electron/preload.cjs && node --check electron/omnibox-preload.cjs"
```

- [ ] **Step 5: Re-run the baseline test**

Run: `node --test tests/smoke-baseline.test.mjs`
Expected: PASS.

- [ ] **Step 6: Scan the staging set before first baseline commit**

Run:
```bash
git status --short
grep -RIlE '(ghp_|github_pat_|sk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]{20,}|-----BEGIN .*PRIVATE KEY-----)' --exclude-dir=.git --exclude='*.md' . || true
```
Expected: no secret-bearing file is staged; `.env.local`, `.env.production`, `.watch_backend_url` remain ignored.

- [ ] **Step 7: Commit the imported 4.1.0 source baseline**

```bash
git add .gitignore package.json tests/smoke-baseline.test.mjs electron src scripts backend build bin public index.html watch-host.html tsconfig.json vite.config.ts MARSHMALLOW_CREATOR.txt README_*.md WALLPAPER_CREDITS.md *.bat *.ps1 *.txt
git commit -m "chore: import MarshMallow 4.1.0 baseline"
```

---

### Task 2: Make native geometry deterministic and fix all dock overlap

**Files:**
- Create: `electron/lib/geometry.mjs`
- Create: `tests/geometry.test.mjs`
- Modify: `electron/main.mjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `computeContentBounds({ windowWidth, windowHeight, shell, sidebarWidth, toolbarHeight, dock }) -> { page, dock }`.
- Produces IPC: `browser:set-dock({ mode: 'none'|'ai'|'watch'|'media', width: number }) -> DockState`.
- `DockState = { mode: string; width: number; pageBounds: Bounds; dockBounds: Bounds | null }`.

- [ ] **Step 1: Write failing geometry tests for the observed media-panel cut-off**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeContentBounds } from '../electron/lib/geometry.mjs';

test('media dock reserves its full native width', () => {
  const result = computeContentBounds({
    windowWidth: 1665,
    windowHeight: 548,
    shell: true,
    sidebarWidth: 72,
    toolbarHeight: 56,
    dock: { mode: 'media', width: 420 },
  });
  assert.equal(result.dock.width, 420);
  assert.equal(result.page.x + result.page.width, result.dock.x);
  assert.equal(result.dock.x + result.dock.width, 1665);
});

test('no dock gives the page all available width', () => {
  const result = computeContentBounds({ windowWidth: 1200, windowHeight: 800, shell: true, sidebarWidth: 72, toolbarHeight: 56, dock: { mode: 'none', width: 0 } });
  assert.equal(result.dock, null);
  assert.equal(result.page.width, 1128);
});
```

- [ ] **Step 2: Run the geometry test and verify it fails**

Run: `node --test tests/geometry.test.mjs`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement `computeContentBounds` as the single source of truth**

```js
export function computeContentBounds({ windowWidth, windowHeight, shell, sidebarWidth, toolbarHeight, dock }) {
  const safeWidth = Math.max(0, Math.floor(windowWidth));
  const safeHeight = Math.max(0, Math.floor(windowHeight));
  if (!shell) return { page: { x: 0, y: 0, width: safeWidth, height: safeHeight }, dock: null };
  const x = Math.max(0, Math.floor(sidebarWidth));
  const y = Math.max(0, Math.floor(toolbarHeight));
  const contentWidth = Math.max(0, safeWidth - x);
  const contentHeight = Math.max(0, safeHeight - y);
  const requestedDock = dock?.mode && dock.mode !== 'none' ? Math.max(0, Math.floor(dock.width || 0)) : 0;
  const dockWidth = Math.min(requestedDock, Math.max(0, contentWidth - 320));
  const page = { x, y, width: Math.max(0, contentWidth - dockWidth), height: contentHeight };
  const dockBounds = dockWidth ? { x: x + page.width, y, width: dockWidth, height: contentHeight } : null;
  return { page, dock: dockBounds };
}
```

- [ ] **Step 4: Integrate one `dockState` in `electron/main.mjs` and remove competing margin/bounds calculations**

Implementation rule: `applyTabArea()` and every window resize/tab switch calls `computeContentBounds(...)`; the active page `WebContentsView` gets `page`; a native dock or renderer-reserved panel gets exactly `dock.width`. No feature computes a different hard-coded dock width.

- [ ] **Step 5: Change React panels to select one dock mode, not stack floating panels**

`PanelName` remains the renderer selection, but calls `setDock()` whenever `media`, `ai`, `watch`, or none becomes active.

- [ ] **Step 6: Make CSS use a shared `--dock-w` only for visual layout and remove `.media-panel` viewport-width sizing that conflicts with native geometry**

Expected rule: `.media-panel { width: 100%; max-width: none; }` inside the reserved dock.

- [ ] **Step 7: Run geometry tests and source verification**

Run: `npm run test:unit && node --check electron/main.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add electron/lib/geometry.mjs tests/geometry.test.mjs electron/main.mjs src/App.tsx src/styles.css src/types.ts
git commit -m "fix: make dock and page geometry deterministic"
```

---

### Task 3: Rebuild toolbar and autocomplete readiness without regressions

**Files:**
- Create: `electron/lib/omnibox-model.mjs`
- Create: `src/lib/omnibox.ts`
- Create: `tests/omnibox-model.test.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/omnibox-preload.cjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `buildOmniboxSuggestions(query, history, bookmarks, tabs, privateMode, now) -> Suggestion[]`.
- IPC/event: omnibox child sends `omnibox:ready`; main stores readiness and replays latest state only after ready.
- IPC: `browser:set-omnibox-overlay(payload)` stores latest state even when child is not ready.

- [ ] **Step 1: Write failing tests for a novel search term and ranking**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOmniboxSuggestions } from '../electron/lib/omnibox-model.mjs';

test('novel term always has an explicit local search candidate', () => {
  const items = buildOmniboxSuggestions('google', [], [], [], false, 1_700_000_000_000);
  assert.equal(items.at(-1).source, 'search');
  assert.match(items.at(-1).title, /Pesquisar/);
});

test('private mode excludes persistent history', () => {
  const items = buildOmniboxSuggestions('example', [{ url:'https://example.com', title:'Example', at:1, visits:5 }], [], [], true, 10);
  assert.equal(items.some((x) => x.source === 'history'), false);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/omnibox-model.test.mjs`
Expected: FAIL because module does not exist.

- [ ] **Step 3: Extract candidate generation into the pure module and mirror typed renderer helper**

Keep the existing alias/ranking semantics, but make `now` injectable for deterministic tests. `src/lib/omnibox.ts` exports matching TS types and implementation used by `App.tsx`.

- [ ] **Step 4: Add the explicit readiness handshake**

`electron/omnibox-preload.cjs`:
```js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('marshmallowOmnibox', {
  ready: () => ipcRenderer.send('omnibox:ready'),
  onState: (callback) => { const fn = (_e, payload) => callback(payload); ipcRenderer.on('omnibox:state', fn); return () => ipcRenderer.removeListener('omnibox:state', fn); },
  choose: (index) => ipcRenderer.send('omnibox:choose', index),
});
```
The overlay page calls `ready()` after its DOM/listener setup. Main keeps `omniboxLatestState` and sends it immediately on `omnibox:ready`.

- [ ] **Step 5: Rebuild toolbar as a single flex/grid row**

Required visible order: `← → ↻ | omnibox | 🎮 ↓ 🧩 ⋯`. `+` stays in tab UI. No direct toolbar child is allowed to create an implicit second row.

- [ ] **Step 6: Clamp autocomplete height and scroll instead of creating the giant black empty surface**

Use candidate count to compute `min(rowHeight * count + footerHeight, maxHeight)`, with a minimum one-row height only when candidates exist.

- [ ] **Step 7: Run tests/typecheck when dependencies are available**

Run: `npm run test:unit`; after dependency install: `npm run typecheck && npm run build:web`.
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add electron/lib/omnibox-model.mjs src/lib/omnibox.ts tests/omnibox-model.test.mjs electron/main.mjs electron/omnibox-preload.cjs electron/preload.cjs src/App.tsx src/styles.css src/types.ts
git commit -m "fix: make toolbar and autocomplete reliable"
```

---

### Task 4: Add Brave-style Back/Forward history menus

**Files:**
- Create: `electron/lib/navigation-history.mjs`
- Create: `tests/navigation-history.test.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `buildHistoryMenu(entries, currentIndex, direction, limit=15) -> HistoryMenuEntry[]`.
- IPC: `browser:get-navigation-history(direction) -> { currentIndex, items }`.
- IPC: `browser:go-navigation-index(index) -> BrowserState`.

- [ ] **Step 1: Write failing slice/order tests**

```js
test('back menu returns nearest previous entry first', () => {
  const entries = ['a','b','c','d'].map((url, index) => ({ url:`https://${url}.test`, title:url, index }));
  const result = buildHistoryMenu(entries, 3, 'back', 15);
  assert.deepEqual(result.map((x) => x.index), [2,1,0]);
});
```

- [ ] **Step 2: Verify failure, implement pure normalizer, then verify pass**

Run: `node --test tests/navigation-history.test.mjs` before/after implementation.

- [ ] **Step 3: Add IPC backed only by `wc.navigationHistory.getAllEntries()`, `getActiveIndex()` and `goToIndex()`**

Do not create a parallel navigation history store.

- [ ] **Step 4: Add interaction contract in React**

Normal left click: one-step navigation. `contextmenu` or pointer hold >= 450 ms: open history menu without also executing one-step navigation. Release before 450 ms remains normal click.

- [ ] **Step 5: Render Black Piano menu with title/domain/favicon, current marker, keyboard escape and click-outside dismissal**

- [ ] **Step 6: Run unit tests and typecheck**

Run: `npm run test:unit && npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add electron/lib/navigation-history.mjs tests/navigation-history.test.mjs electron/main.mjs electron/preload.cjs src/App.tsx src/styles.css src/types.ts
git commit -m "feat: add navigation history jump menus"
```

---

### Task 5: Implement per-domain Game Mode and window Game Scheduler

**Files:**
- Create: `electron/lib/game-mode.mjs`
- Create: `tests/game-mode.test.mjs`
- Create: `src/lib/domainSettings.ts`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- `GameModePreference = 'auto'|'on'|'off'`.
- `GameDomainSetting = { mode: GameModePreference; saveResourcesInBackground: boolean }`.
- `resolveGameMode({ preference, signals }) -> { active:boolean; score:number; reasons:string[] }`.
- `resolveWindowBackgroundPolicy(tabs) -> { continuous:boolean; demandingTabIds:string[] }`.
- IPC: `browser:get-game-mode()`, `browser:set-game-mode(setting)`, `browser:report-game-signals(signals)`.

- [ ] **Step 1: Write failing policy tests**

```js
test('manual off wins over auto signals', () => {
  const result = resolveGameMode({ preference:'off', signals:{ largeCanvas:true, webgl:true, pointerLock:true } });
  assert.equal(result.active, false);
});

test('one active background game makes window continuous', () => {
  const result = resolveWindowBackgroundPolicy([
    { id:'a', gameActive:true, saveResourcesInBackground:false },
    { id:'b', gameActive:false, saveResourcesInBackground:false },
  ]);
  assert.equal(result.continuous, true);
  assert.deepEqual(result.demandingTabIds, ['a']);
});
```

- [ ] **Step 2: Verify failure, implement pure policy, verify pass**

Run: `node --test tests/game-mode.test.mjs`.

- [ ] **Step 3: Persist domain settings in the existing browser session/preferences file under a versioned `gameModeByDomain` map**

Sanitize keys to hostnames and values to the exact schema above.

- [ ] **Step 4: Inject a lightweight page signal probe only for ordinary HTTP(S) pages**

Probe signals include large visible canvas, `webgl`/`webgl2` context acquisition observation where safely detectable, fullscreen/pointer-lock activity, and sustained requestAnimationFrame activity. Send aggregate booleans/counts only to main; never send page content or browsing telemetry to servers.

- [ ] **Step 5: Implement Game Scheduler**

Whenever tabs/signals/preferences change, compute window policy and call `webContents.setBackgroundThrottling(false)` for page views only while at least one active game requires it; restore configured normal throttling when none do.

- [ ] **Step 6: Extend permission handling narrowly**

Recognize `pointerLock` and `keyboardLock` as game-relevant permissions only after a legitimate page request. Game Mode may choose an allow/ask policy for these specific permissions but must not auto-grant camera/microphone/location/HID/clipboard.

- [ ] **Step 7: Add 🎮 toolbar state and per-site menu**

Show `Automático`, `Sempre ligado`, `Desligado`, plus `Economizar recursos em segundo plano`.

- [ ] **Step 8: Run unit tests + source verification**

Run: `npm run test:unit && npm run typecheck && node --check electron/main.mjs`.

- [ ] **Step 9: Commit**

```bash
git add electron/lib/game-mode.mjs tests/game-mode.test.mjs src/lib/domainSettings.ts electron/main.mjs electron/preload.cjs src/App.tsx src/styles.css src/types.ts
git commit -m "feat: add per-site game mode and scheduler"
```

---

### Task 6: Add factual `marshmallow://performance` diagnostics

**Files:**
- Modify: `electron/main.mjs`
- Modify: `src/types.ts`

**Interfaces:**
- Internal page id adds `performance`.
- IPC/internal data: `{ gpuInfo, featureStatus, gameMode, backgroundPolicy, gamepadAvailable }`.

- [ ] **Step 1: Add an invariant test to `tests/smoke-baseline.test.mjs` requiring the internal page id in source metadata**

Test reads `electron/main.mjs` and asserts `performance` page registration exists; verify it fails before implementation.

- [ ] **Step 2: Register `marshmallow://performance` and gather facts using `app.getGPUFeatureStatus()` and `app.getGPUInfo('basic')`**

Map statuses literally to `Hardware`, `Software`, `Disabled`, `Unavailable/Unknown`; never convert unknown states into “optimized”.

- [ ] **Step 3: Display current active-tab Game Mode/domain setting, scheduler state and Gamepad API availability**

- [ ] **Step 4: Run unit/syntax checks**

Run: `npm run test:unit && node --check electron/main.mjs`.

- [ ] **Step 5: Commit**

```bash
git add electron/main.mjs src/types.ts tests/smoke-baseline.test.mjs
git commit -m "feat: add performance diagnostics page"
```

---

### Task 7: Replace extension-only media detection with request/MIME/stream classification and grouping

**Files:**
- Create: `electron/lib/media-detection.mjs`
- Create: `tests/media-detection.test.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- `classifyMediaObservation({ url, mimeType, resourceType, contentLength, responseHeaders, pageUrl }) -> MediaObservation | null`.
- `MediaObservation.kind = 'audio'|'video'|'muxed'|'manifest'`.
- `groupMediaObservations(observations) -> MediaGroup[]` deduplicates segment churn.
- `MediaCandidate` gains optional `resolution`, `container`, `codec`, `bitrate`, `streamGroupId`, `hasAudio`, `hasVideo`, `direct`.

- [ ] **Step 1: Write failing MIME/no-extension/adaptive tests**

```js
test('video MIME wins even when URL has no extension', () => {
  const item = classifyMediaObservation({ url:'https://cdn.test/videoplayback?id=1', mimeType:'video/mp4', resourceType:'media', pageUrl:'https://site.test' });
  assert.equal(item.kind, 'video');
  assert.equal(item.container, 'mp4');
});

test('DASH manifest is classified as manifest', () => {
  const item = classifyMediaObservation({ url:'https://cdn.test/manifest?id=1', mimeType:'application/dash+xml', resourceType:'xhr', pageUrl:'https://site.test' });
  assert.equal(item.kind, 'manifest');
});

test('repeated adaptive segments collapse to one stream group', () => {
  const grouped = groupMediaObservations([
    { id:'1', kind:'video', url:'https://cdn.test/chunk?range=0-100', streamGroupId:'cdn.test/chunk', detectedAt:1 },
    { id:'2', kind:'video', url:'https://cdn.test/chunk?range=101-200', streamGroupId:'cdn.test/chunk', detectedAt:2 },
  ]);
  assert.equal(grouped.length, 1);
});
```

- [ ] **Step 2: Verify failure, implement classifiers/grouping, verify pass**

Run: `node --test tests/media-detection.test.mjs`.

- [ ] **Step 3: Correlate `webRequest.onHeadersReceived`/request metadata with current tab instead of relying on URL extension**

Read `Content-Type`, `Content-Length` and safe response headers; preserve the existing DRM exclusion rules. `blob:` URLs are page/runtime signals only and are never exposed as direct remote downloads.

- [ ] **Step 4: Add page-side MediaSource/blob signal correlation without presenting blob URLs as downloadable**

Use aggregate metadata only to mark the tab as adaptive-streaming-capable and correlate nearby network observations.

- [ ] **Step 5: Redesign media UI cards**

Examples: `▶ Vídeo 1080p — WebM / VP9 — sem áudio`, `♫ Áudio — Opus — 128 kbps`, `▤ Stream DASH`. Explain why MP3/MP4 buttons are disabled when FFmpeg is absent.

- [ ] **Step 6: Ensure a page with observable `video/*` traffic cannot be labeled audio-only**

Add an integration-level pure test that groups one audio and one video observation from the same page and asserts both categories are present.

- [ ] **Step 7: Run tests/typecheck**

Run: `npm run test:unit && npm run typecheck`.

- [ ] **Step 8: Commit**

```bash
git add electron/lib/media-detection.mjs tests/media-detection.test.mjs electron/main.mjs electron/preload.cjs src/App.tsx src/styles.css src/types.ts
git commit -m "fix: detect adaptive audio and video streams accurately"
```

---

### Task 8: Add safe local video+audio merge and clearer download actions

**Files:**
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `tests/media-detection.test.mjs`

**Interfaces:**
- `downloadMedia(id, format)` extends format to `'original'|'mp3'|'mp4'|'merge'`.
- New IPC may accept `{ videoId, audioId, format:'merge' }` for explicit pair selection.

- [ ] **Step 1: Add failing pairing tests**

Add `selectMergePair(groups, preferredVideoId)` test that chooses compatible audio/video from the same page/stream family and never pairs DRM/protected observations.

- [ ] **Step 2: Verify failure, implement pairing helper, verify pass**

- [ ] **Step 3: Implement FFmpeg remux command for safe merge**

Use `-i video -i audio -c copy` first; only use conversion options for explicit MP3/MP4 conversion. Never decrypt or request keys for encrypted/DRM content.

- [ ] **Step 4: Surface `Vídeo + áudio` only when both streams and FFmpeg are available**

Original direct download remains available for valid direct sources.

- [ ] **Step 5: Run unit/syntax/type checks**

Run: `npm run test:unit && npm run typecheck && node --check electron/main.mjs`.

- [ ] **Step 6: Commit**

```bash
git add electron/main.mjs electron/preload.cjs src/App.tsx src/types.ts tests/media-detection.test.mjs
git commit -m "feat: merge compatible video and audio streams locally"
```

---


### Task 8A: Add the standard browser download manager and reserve standalone Manager integration

**Files:**
- Create: `electron/lib/download-manager.mjs`
- Create: `tests/download-manager.test.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`
- Modify: `site/download/manager.json` in the release kit

**Interfaces:**
- `DownloadRecord = { id, url, filename, savePath, state, receivedBytes, totalBytes, progress, startedAt, updatedAt, canResume }`.
- IPC: `browser:get-downloads()`, `browser:pause-download(id)`, `browser:resume-download(id)`, `browser:cancel-download(id)`, `browser:open-download(id)`, `browser:show-download(id)`, `browser:clear-download-history()`.
- `validateDownloaderManagerManifest(json) -> { ok, available, version, url, protocol, error? }`.
- External protocol contract: `marshmallow-downloader://add?url=...&filename=...`.

- [ ] **Step 1: Write failing pure tests for progress/state and standalone-manager metadata validation.**
- [ ] **Step 2: Run the new test and verify RED for missing module/functions.**
- [ ] **Step 3: Implement the pure helper module minimally and re-run to GREEN.**
- [ ] **Step 4: Track Electron `DownloadItem` lifecycle, persist bounded recent history locally, and emit snapshots to the renderer.**
- [ ] **Step 5: Add pause/resume/cancel/open/show/clear-history IPC.**
- [ ] **Step 6: Turn the toolbar download dock into two views: `Downloads` and `Mídia da página`.**
- [ ] **Step 7: Add Settings → Downloads integration card; built-in is default; standalone is disabled while official manifest says unavailable.**
- [ ] **Step 8: Reserve external protocol handoff with safe fallback to the built-in manager if protocol opening fails.**
- [ ] **Step 9: Add `manager.json` with `available:false` for 5.0.0 so the UI never points to a dead installer.**
- [ ] **Step 10: Run unit/source/type/build verification and commit.**

---
### Task 9: Add discreet support page and About entry

**Files:**
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs` if external-opening helper is needed
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Modify: `src/types.ts`

**Interfaces:**
- Internal page id adds `support`.
- Support page contains exactly the three approved external URLs and uses `shell.openExternal` through a narrow allowlist.

- [ ] **Step 1: Add failing source-invariant test for all three exact URLs and `support` internal page**

- [ ] **Step 2: Register `marshmallow://support` and narrow external-open allowlist**

Only HTTPS URLs whose host/path match the three approved support destinations may be opened by this internal action.

- [ ] **Step 3: Add one `♡` button to lower sidebar and one small About/Settings support entry**

No badge, animation, auto-open, periodic reminder or page injection.

- [ ] **Step 4: Run unit/type/syntax checks**

- [ ] **Step 5: Commit**

```bash
git add electron/main.mjs electron/preload.cjs src/App.tsx src/styles.css src/types.ts tests/smoke-baseline.test.mjs
git commit -m "feat: add discreet project support links"
```

---

### Task 10: Add update metadata, SHA-256 verification and 5.0 version consistency

**Files:**
- Create: `electron/lib/update-verifier.mjs`
- Create: `tests/update-verifier.test.mjs`
- Create: `scripts/verify-5.0.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/App.tsx`
- Modify: `src/types.ts`
- Modify: `package.json`

**Interfaces:**
- `compareVersions(a,b) -> -1|0|1`.
- `validateReleaseMetadata(json) -> { ok, version, url, sha256, error? }`.
- `sha256File(path) -> Promise<string>`.
- IPC: `browser:check-update()`, `browser:download-update()`; downloaded installer is `verified:true` only after SHA match.

- [ ] **Step 1: Write failing version/metadata/hash tests**

```js
test('5.0.1 is newer than 5.0.0', () => assert.equal(compareVersions('5.0.1','5.0.0'), 1));
test('release metadata rejects non-https installer URL', () => assert.equal(validateReleaseMetadata({version:'5.0.1',url:'http://x',sha256:'a'.repeat(64)}).ok, false));
```

- [ ] **Step 2: Verify failure, implement pure update verifier, verify pass**

- [ ] **Step 3: Set all app-visible package/runtime version values to `5.0.0`**

Update `package.json`, `VERSION` in main and any installer BAT/source metadata used by current build flow.

- [ ] **Step 4: Implement About update check using one official `release.json` URL and no silent update**

Display current/update available, official GitHub installer link and published SHA-256.

- [ ] **Step 5: Implement optional installer download and hash verification**

Do not launch/present “verified” if computed SHA differs; delete/quarantine the failed temp download and show error.

- [ ] **Step 6: Create `scripts/verify-5.0.mjs`**

It must fail non-zero when package/main/site/release notes disagree on version, support links differ, unsafe Electron preferences appear, or secret-like tokens are found in publishable files.

- [ ] **Step 7: Expand package verification scripts**

```json
"verify:source": "npm run test:unit && node --check electron/main.mjs && node --check electron/preload.cjs && node --check electron/omnibox-preload.cjs && node scripts/verify-5.0.mjs"
```

- [ ] **Step 8: Run unit/source/type/build checks**

Run: `npm run verify:source`; after installing deps: `npm run typecheck && npm run build:web`.

- [ ] **Step 9: Commit**

```bash
git add electron/lib/update-verifier.mjs tests/update-verifier.test.mjs scripts/verify-5.0.mjs electron/main.mjs electron/preload.cjs src/App.tsx src/types.ts package.json
git commit -m "feat: verify MarshMallow updates by release hash"
```

---

### Task 11: Regression pass for existing browser features and UI behavior

**Files:**
- Modify only files required by observed regression failures.
- Create: `tests/regression-invariants.test.mjs`

**Interfaces:**
- No new public interface unless a failing regression proves one is necessary.

- [ ] **Step 1: Add static/invariant tests for required 4.1 behavior**

Assertions cover: extension IPC still present; private-tab IPC still present; session restore functions still registered; Watch Together IPC still present; toolbar contains media/extensions/game/overflow controls; support does not auto-open.

- [ ] **Step 2: Run all unit/source checks and fix only demonstrated failures**

Run: `npm run verify:source`.

- [ ] **Step 3: Install dependencies in a clean build workspace and run production compile**

Run:
```bash
npm ci
npm run typecheck
npm run build:web
```
Expected: all PASS with no TypeScript errors.

- [ ] **Step 4: Build Windows NSIS installer on Windows**

Run: `npm run dist`
Expected artifact: `release/MarshMallow-Setup-5.0.0.exe`.

- [ ] **Step 5: Execute Windows runtime smoke matrix**

Required manual/runtime evidence:
1. Back/Forward short click and right-click/450 ms history jump.
2. Type `google` with empty relevant history: visible search candidate on first interaction; Up/Down/Tab/Enter/Esc work.
3. Toolbar tools stay one row at normal and narrow widths.
4. Media dock opens fully at multiple widths; page never covers it.
5. Adaptive video site exposes video when `video/*` traffic is observable; audio/video grouped sanely; no DRM circumvention.
6. At least one HTML5/WebGL browser game: automatic/manual Game Mode, fullscreen, pointer/keyboard request handling and background scheduler.
7. Per-site Game Mode persistence and `Economizar recursos em segundo plano` override.
8. Extensions list/load path, private browsing, bookmarks, session restore and Watch Together smoke.
9. Installer launch, uninstall/reinstall sanity.
10. `marshmallow://performance` reports factual GPU/WebGL state.

- [ ] **Step 6: Record runtime result**

Create `VALIDATION_REPORT_5.0.0.txt` with command outputs and explicit PASS/FAIL per smoke item. If any required item is untested, report `BLOCKED` and do not publish.

- [ ] **Step 7: Commit verified regression fixes/report template**

```bash
git add tests/regression-invariants.test.mjs VALIDATION_REPORT_5.0.0.txt electron src package.json
git commit -m "test: verify MarshMallow 5.0 browser regressions"
```

---

### Task 12: Build release kit, site support page and publication scripts

**Files:**
- Create: `README_5.0.0.md`
- Create: `5.0.0.md`
- Create: `releases/5.0.0.md`
- Create/update release-kit site: `MarshMallow-Official-Website-5.0.0/site/...`
- Create: `PUBLICAR_MARSHMALLOW_5.0.0.bat`
- Create: `DIAGNOSTICAR_MARSHMALLOW_5.0.0.bat`

**Interfaces:**
- `site/download/release.json` is the single canonical public release metadata consumed by site and browser.
- Required JSON fields: `version`, `available`, `url`, `sha256`, `size`, `publishedAt`, `releaseUrl`.

- [ ] **Step 1: Create release notes from actually verified features only**

Do not claim a runtime capability that did not pass Task 11.

- [ ] **Step 2: Build restrained `/apoie/` page**

Include the three approved links once each plus the independence/support copy; no modal/popup or repetitive banners.

- [ ] **Step 3: Update home/resources to 5.0.0 and point download UI at `release.json`**

Site must not hard-code a second installer URL that can diverge.

- [ ] **Step 4: Compute installer SHA-256 and populate `release.json`**

Windows PowerShell example:
```powershell
$hash=(Get-FileHash -Algorithm SHA256 '.\release\MarshMallow-Setup-5.0.0.exe').Hash.ToLower()
```

- [ ] **Step 5: Create fail-loud publication script**

The script must: verify local installer/hash/report; require `VALIDATION_REPORT_5.0.0.txt` to contain all required PASS markers; authenticate GitHub/Cloudflare; push source/public record; create/update tag `v5.0.0`; upload installer + SHA; deploy site; then query GitHub Release and public `version.json`/`release.json` and compare version/hash/size before printing success.

- [ ] **Step 6: Create read-only diagnostic script**

It checks GitHub release/tag/assets and live Cloudflare site metadata without mutating production.

- [ ] **Step 7: Run source/release consistency verification again**

Run: `npm run verify:source` plus publication script preflight mode.

- [ ] **Step 8: Commit release kit**

```bash
git add README_5.0.0.md 5.0.0.md releases/5.0.0.md MarshMallow-Official-Website-5.0.0 PUBLICAR_MARSHMALLOW_5.0.0.bat DIAGNOSTICAR_MARSHMALLOW_5.0.0.bat
git commit -m "release: prepare MarshMallow 5.0.0"
```

---

### Task 13: Publish only after verification and confirm production

**Files:**
- No source edits unless verification exposes a real defect; any defect returns to its owning task/test cycle.

**Interfaces:**
- GitHub target: `blckbr/MarshMallow-Browser`.
- Release tag: `v5.0.0`.
- Cloudflare Pages project: `marshmallow-browser-br`.

- [ ] **Step 1: Run verification-before-completion checklist**

Required commands in the release workspace:
```bash
npm run verify:source
npm run typecheck
npm run build:web
```
Required Windows evidence: `npm run dist` PASS + Task 11 runtime matrix PASS.

- [ ] **Step 2: Run `PUBLICAR_MARSHMALLOW_5.0.0.bat` on the authenticated Windows environment**

The script is allowed to mutate GitHub/Cloudflare only after the user-approved publication request already present in this project.

- [ ] **Step 3: Independently confirm GitHub release**

Check tag `v5.0.0`, installer asset name `MarshMallow-Setup-5.0.0.exe`, asset byte size and SHA file against local values.

- [ ] **Step 4: Independently confirm public site**

Fetch cache-busted `version.json` and `download/release.json`; require `5.0.0`, same installer URL and same SHA-256. Confirm `/apoie/` responds and contains the three approved links.

- [ ] **Step 5: Final completion report**

Report only verified facts: source commit SHA, release URL, installer URL, installer size, SHA-256, site URL, validation report result, and any remaining known limitations. Never claim “Firefox/Brave parity”; describe the verified 5.0 capabilities instead.

