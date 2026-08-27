# MarshMallow Browser Linux RPM / AppImage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a cross-platform MarshMallow Browser 5.0.2 source tree with official x86_64 RPM and AppImage packaging for Fedora/Ultramarine/RHEL/Rocky/Alma, preserving Windows behavior.

**Architecture:** Keep the existing Electron/React browser core. Add a small `electron/lib/platform.mjs` boundary for platform naming, icons, browser discovery, update behavior and xdg commands; update renderer copy from `BrowserState.platform`; add Linux packaging metadata and shell release scripts. Windows-only PowerShell/Registry code remains present but unreachable on Linux.

**Tech Stack:** Electron 43.4.1, React 19.2.8, TypeScript 5.9, Vite 8.2.2, electron-builder 26.15.3, Node test runner, Bash, RPM/DNF/freedesktop conventions.

**Spec:** `docs/superpowers/specs/2026-08-27-marshmallow-linux-rpm-design.md`

## Global Constraints

- Version remains exactly `5.0.2`.
- Product attribution remains `Deivison Santos (@devsaex)`.
- Linux application ID remains `com.devsaex.marshmallow`.
- Initial Linux architecture is x86_64 only.
- Supported family target is Fedora, Ultramarine, RHEL, Rocky Linux and AlmaLinux.
- Windows packaging and runtime behavior must remain available.
- No default `--no-sandbox`, no disabling SELinux, no root runtime requirement, no DRM circumvention.
- Wallpaper is visible only on a true new tab and never leaks behind web/internal pages.

---

### Task 1: Establish Linux platform contracts

**Files:**
- Create: `tests/linux-platform.test.mjs`
- Create: `electron/lib/platform.mjs`
- Modify: `electron/main.mjs`
- Modify: `src/types.ts`

**Interfaces:**
- Produces `runtimePlatformInfo(platform)`, `appIconFilename(platform)`, `cleanUserAgentPlatform(platform)`, `defaultNativeBrowser(platform)`, `linuxBrowserCandidates()` and `linuxUpdatePolicy()` from `electron/lib/platform.mjs`.
- Adds `platform: string` to `BrowserState` and `allTabsState()`.

- [ ] **Step 1: Write failing platform contract tests** asserting Linux state exposure, Linux icon/UA/default browser policy, no `.exe` update path on Linux, and Windows compatibility.
- [ ] **Step 2: Run `node --test tests/linux-platform.test.mjs`** and verify it fails because the platform helper/state do not exist.
- [ ] **Step 3: Implement `electron/lib/platform.mjs`** with pure functions. Example public behavior:

```js
export function runtimePlatformInfo(platform = process.platform) {
  return { platform, isWindows: platform === "win32", isLinux: platform === "linux", isMac: platform === "darwin" };
}
export function appIconFilename(platform = process.platform) {
  return platform === "win32" ? "icon.ico" : "icon.png";
}
export function cleanUserAgentPlatform(platform = process.platform) {
  if (platform === "linux") return "X11; Linux x86_64";
  if (platform === "darwin") return "Macintosh; Intel Mac OS X 10_15_7";
  return "Windows NT 10.0; Win64; x64";
}
export function defaultNativeBrowser(platform = process.platform) {
  return platform === "win32" ? "edge" : "system";
}
```

- [ ] **Step 4: Wire the helpers into `electron/main.mjs`** for `APP_ICON`, clean UA, default native browser and `allTabsState().platform`.
- [ ] **Step 5: Add `platform: string` to `BrowserState` and renderer initial state.**
- [ ] **Step 6: Re-run the task test plus `node --check electron/main.mjs` and `npm run typecheck`.**
- [ ] **Step 7: Commit** `test/feat: establish Linux platform boundary`.

### Task 2: Make native-browser, updater and system integration Linux-safe

**Files:**
- Modify: `electron/lib/platform.mjs`
- Modify: `electron/main.mjs`
- Modify: `electron/preload.cjs`
- Modify: `src/types.ts`
- Modify: `src/App.tsx`
- Test: `tests/linux-platform.test.mjs`

**Interfaces:**
- `nativeBrowserCandidates()` returns real Windows or Linux candidate paths.
- New preload call `makeDefaultBrowser(): Promise<{ok:boolean; error?:string}>` invokes `browser:make-default-browser`.
- `checkForUpdate()` on Linux reports package-manager update mode without exposing a Windows installer.

- [ ] **Step 1: Add failing tests** for Linux Chrome/Edge candidate paths, system-browser label, Linux updater policy, explicit xdg default-browser command and UI copy.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement Linux browser candidates** such as `/usr/bin/google-chrome`, `/usr/bin/google-chrome-stable`, `/usr/bin/microsoft-edge`, `/usr/bin/microsoft-edge-stable`, while preserving Windows candidates.
- [ ] **Step 4: Implement explicit Linux default-browser registration** by spawning `xdg-settings set default-web-browser marshmallow-browser.desktop` and `xdg-mime default marshmallow-browser.desktop x-scheme-handler/http`, `https`, and `marshmallow`; return a structured error when xdg utilities are absent.
- [ ] **Step 5: Guard updater download on Linux** so it never proposes/saves `MarshMallow-Setup-*.exe`; return package-manager guidance instead.
- [ ] **Step 6: Update renderer system labels and actions** using `state.platform`: generic downloads folder, Linux default-browser button, generic native-browser label, Linux/Windows About label.
- [ ] **Step 7: Verify tests, typecheck and syntax.**
- [ ] **Step 8: Commit** `feat: add Linux system integration`.

### Task 3: Make extension archive handling and media messages cross-platform

**Files:**
- Modify: `electron/main.mjs`
- Test: `tests/linux-platform.test.mjs`

**Interfaces:**
- `runExtensionArchiveExtract(zipPath, destination)` and `runExtensionArchivePack(sourcePath, outputPath)` dispatch to PowerShell on Windows and `unzip`/`zip` on Linux.
- Linux archive preflight rejects absolute paths, `..` traversal, entry-count overflow and declared uncompressed-size overflow before extraction.

- [ ] **Step 1: Add failing tests** proving PowerShell is guarded by `process.platform === "win32"`, Linux uses `unzip`/`zip`, and Linux media copy says `ffmpeg` rather than `ffmpeg.exe`.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Add a reusable child-process runner** returning `{ok, code, stdout, stderr}`.
- [ ] **Step 4: Add Linux ZIP listing preflight** using `unzip -Z1` plus metadata inspection; reject entries containing absolute roots or normalized `..`, more than `EXTENSION_ENTRY_LIMIT`, or archive totals beyond `EXTENSION_EXTRACT_LIMIT`.
- [ ] **Step 5: Use `unzip -qq -o` for extraction and `zip -qr` for packing on Linux; retain the existing PowerShell implementation on Windows.**
- [ ] **Step 6: Make FFmpeg capability/error messages platform-neutral.**
- [ ] **Step 7: Verify Linux contract tests and existing extension-related tests.**
- [ ] **Step 8: Commit** `feat: make extension archives Linux-safe`.

### Task 4: Hide Windows-only wallpaper actions and preserve new-tab-only wallpaper

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css` only if required by tests
- Test: `tests/linux-platform.test.mjs`
- Test: `tests/chrome-navigation-ui.test.mjs`

**Interfaces:**
- Renderer derives `const isWindows = state.platform === "win32"`.
- Windows desktop/lockscreen actions render only when `isWindows`.

- [ ] **Step 1: Add failing tests** asserting Windows wallpaper action buttons are conditional and new-tab wallpaper isolation remains wired.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Gate Windows wallpaper action buttons and Windows-specific success/failure copy.**
- [ ] **Step 4: Replace Watch Together “áudio geral do Windows” with “áudio geral do sistema”.**
- [ ] **Step 5: Re-run omnibox/wallpaper regressions and typecheck.**
- [ ] **Step 6: Commit** `fix: isolate Windows-only wallpaper actions`.

### Task 5: Add official RPM and AppImage packaging

**Files:**
- Modify: `package.json`
- Create: `build/linux/marshmallow-browser.desktop`
- Create: `tests/linux-package.test.mjs`
- Use existing: `build/icon.png`, `build/icon-source.png`

**Interfaces:**
- New scripts: `dist:linux:rpm`, `dist:linux:appimage`, `dist:linux`.
- Electron Builder Linux target uses executable `marshmallow-browser`, category `Network;WebBrowser;`, RPM and AppImage artifact names.

- [ ] **Step 1: Write failing package tests** for appId, author, Linux targets, executable, artifact names, desktop entry, protocols and preservation of Windows NSIS config.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Extend `package.json`** with Linux targets and scripts without deleting `win` or `nsis`.
- [ ] **Step 4: Add desktop metadata** declaring `Name=MarshMallow Browser`, `Exec=marshmallow-browser %U`, `Terminal=false`, `Categories=Network;WebBrowser;`, and MIME handlers for HTTP/HTTPS/MarshMallow.
- [ ] **Step 5: Verify package tests and JSON validity.**
- [ ] **Step 6: Commit** `build: add RPM and AppImage targets`.

### Task 6: Add reproducible Linux build, verify and smoke scripts

**Files:**
- Create: `scripts/linux/verify-linux.sh`
- Create: `scripts/linux/build-rpm.sh`
- Create: `scripts/linux/build-appimage.sh`
- Create: `scripts/linux/smoke-linux.sh`
- Create: `tests/linux-scripts.test.mjs`

**Interfaces:**
- Scripts accept project root from their own location and never assume `C:\...`.
- `verify-linux.sh` runs source tests/typecheck/build and checks Linux tools.
- Build scripts write to `release/` and fail closed.
- Smoke script uses an installed display or `xvfb-run` when available.

- [ ] **Step 1: Add failing script contract tests** for `set -euo pipefail`, root resolution, no `sudo`, no `--no-sandbox`, expected electron-builder targets and artifact names.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement `verify-linux.sh`.**
- [ ] **Step 4: Implement RPM/AppImage build scripts** invoking `npm run build:web` then `npx electron-builder --linux rpm --x64` / `--linux AppImage --x64`.
- [ ] **Step 5: Implement smoke script** that selects `release/linux-unpacked/marshmallow-browser` when available, launches it with a temporary user-data dir, waits for process stability, then terminates cleanly; use `xvfb-run -a` only when DISPLAY/Wayland are absent and Xvfb exists.
- [ ] **Step 6: Verify script tests and shell syntax (`bash -n`).**
- [ ] **Step 7: Commit** `build: add Linux release pipeline`.

### Task 7: Build and inspect Linux artifacts

**Files:**
- Generated: `release/MarshMallow-Browser-5.0.2-x86_64.rpm`
- Generated: `release/MarshMallow-Browser-5.0.2-x86_64.AppImage`
- Generated/inspect: `release/linux-unpacked/*`

**Interfaces:**
- No source API changes.

- [ ] **Step 1: Run dependency installation from the lockfile** with `npm ci --no-audit --no-fund` (or document exact network/cache blocker).
- [ ] **Step 2: Run full source validation** (`npm run test:unit`, `npm run typecheck`, `npm run build:web`, Node syntax checks).
- [ ] **Step 3: Build AppImage and RPM.**
- [ ] **Step 4: Inspect artifacts** with `file`, `sha256sum`, AppImage permissions, and `rpm -qip/-qlp` when `rpm` is available.
- [ ] **Step 5: Run smoke test** against Linux unpacked runtime when dependencies/display allow it.
- [ ] **Step 6: If a tool/environment blocks a binary artifact, stop fabricating and record the exact blocker while keeping the buildable source/scripts.**

### Task 8: Produce release documentation and source bundle

**Files:**
- Create: `INSTALAR-MARSHMALLOW-RHEL.txt`
- Create: `RELATORIO-VALIDACAO-LINUX.txt`
- Create: `SHA256SUMS.txt`
- Generated: `MarshMallow-Browser-5.0.2-Linux-Source.zip`

**Interfaces:**
- Installation guide covers DNF local RPM install, removal, AppImage fallback, default browser action and SELinux-safe behavior.
- Validation report distinguishes build validation, runtime smoke validation and untested physical distro/hardware behavior.

- [ ] **Step 1: Write installation guide** with `sudo dnf install ./MarshMallow-Browser-5.0.2-x86_64.rpm`, removal via `sudo dnf remove marshmallow-browser`, and AppImage executable/run steps.
- [ ] **Step 2: Generate SHA-256 manifest** for every successfully produced release artifact.
- [ ] **Step 3: Write factual validation report** from actual command outputs only.
- [ ] **Step 4: Create source ZIP** excluding `.git`, `node_modules`, `release` binaries and temporary user data, while including docs/scripts/tests/build resources.
- [ ] **Step 5: Run final verification** over source bundle contents and hashes.
- [ ] **Step 6: Commit** `docs: finalize Linux release package`.
