# MarshMallow 5.0 — Design

Date: 2026-08-22
Status: Approved direction, implementation pending final spec review
Owner/creator credit: Deivison Santos / @devsaex

## Goals

MarshMallow 5.0 is a major quality release focused on browser-grade navigation, modern browser-game compatibility, UI reliability, media detection/download UX, discreet voluntary-support integration, and safer update delivery. It evolves the existing Electron/WebContentsView architecture rather than replacing it with a Chromium fork.

Success means the browser remains visually recognizable as Black Piano, existing features remain available, and the new release fixes the concrete regressions observed in 4.1.0 before publication.

## 1. Navigation history menus

Back and Forward retain normal one-step click behavior.

A long press of approximately 450 ms or right-click opens a Black Piano history menu for the current tab. The menu is sourced from Electron navigationHistory, not a parallel history implementation. It shows nearby previous/next entries with title, URL/domain and favicon when available, marks the current entry, and jumps directly to the selected navigation index.

Keyboard shortcuts remain compatible with Alt+Left and Alt+Right.

## 2. Toolbar redesign

The toolbar becomes a single responsive row with three logical groups:

- navigation: Back, Forward, Reload/Stop;
- omnibox: security indicator, address/search input, bookmark control;
- tools: Game Mode, Media/Downloads, Extensions and overflow menu.

The new-tab action remains near the tab UI. Less frequent actions such as DevTools, private window/tab, history, downloads and settings move to the overflow menu when appropriate.

No direct toolbar child may spill into an implicit second grid row. The layout must remain usable at narrower window sizes.

## 3. Omnibox/autocomplete

Autocomplete is treated as a first-class component. Sources may include local history, bookmarks, open tabs, typed URLs and an explicit search candidate. Remote search suggestions are used only if the chosen engine supports them and the user has enabled that behavior.

The existing race in which the suggestions WebContentsView can become visible before its listener is ready is removed by an explicit readiness handshake and state replay. The panel must never open as a large empty black surface when candidates exist.

The popup is anchored below the omnibox, clamped to the window, has a maximum height with scrolling, and supports Up/Down, Tab, Enter and Escape consistently. Private browsing excludes persistent-history results.

Regression requirement: typing a novel term such as `google` must still show at least the local search candidate even with no matching history.

## 4. Game Mode

Game Mode has three persisted states per domain: Automatic, Always On, Off.

Automatic detection uses local technical signals rather than a fixed game allowlist. Signals may include a significant canvas/WebGL surface, fullscreen requests, Pointer Lock, Keyboard Lock, animation/render loops and other browser-game behavior. Detection never sends browsing data to a server.

A visible Game Mode control lets the user override automatic detection per domain.

### Runtime policy

When active, Game Mode prioritizes compatibility with modern browser games using Chromium capabilities directly, including:

- WebGL/WebGL2 and Canvas;
- WebAssembly;
- WebSocket/fetch networking;
- WebAudio;
- Gamepad API;
- fullscreen;
- Pointer Lock and Keyboard Lock after legitimate page/user requests;
- cookies, IndexedDB, LocalStorage and Cache Storage within the normal profile session.

Game Mode does not silently grant sensitive permissions. Camera, microphone, location, clipboard, HID and similar capabilities continue to use normal permission policy.

Popups and downloads remain subject to browser security rules.

### Background execution

Default behavior for a site in Game Mode is to keep the game running in background. A per-site option `Economizar recursos em segundo plano` allows opting back into normal throttling.

Because Electron backgroundThrottling is effectively window-level when one visible WebContents disables it, MarshMallow uses a window Game Scheduler: if any open game tab currently requires continuous background execution, the window adopts that policy; when none require it, normal throttling is restored.

## 5. Performance diagnostics

Add an internal diagnostics page, `marshmallow://performance`, showing factual capability status rather than marketing labels.

It includes GPU adapter information when available, GPU compositing status, WebGL/WebGL2 status, Canvas acceleration status, current Game Mode state, background execution policy and Gamepad availability.

Unavailable or software-rendered capabilities are reported accurately.

## 6. Media detector/downloader redesign

The media tool must remain visible and reachable from the toolbar. The panel must be completely readable and never be covered/cut by a page WebContentsView.

The current dock sizing bug is fixed by deriving the native content bounds from the actual media dock width, with a single shared source of truth for CSS and BrowserWindow/WebContentsView geometry.

### Detection

Detection must not rely only on URL file extensions. It combines request metadata and page/runtime observations and classifies media as:

- Audio;
- Video;
- Audio+Video;
- Manifest/stream.

The detector uses Content-Type where available and handles adaptive streaming URLs that do not end in `.mp4`, `.webm`, etc. HLS/DASH manifests are recognized. MediaSource/blob use is treated as a signal to correlate with network requests; blob URLs are not presented as directly downloadable remote resources.

Repeated adaptive-segment URLs are deduplicated/grouped rather than flooding the UI.

When metadata permits, the UI shows useful labels such as resolution, container, codec and audio bitrate.

### Download actions

`Original` downloads a directly available detected source when valid.

When separate video and audio streams can be identified and FFmpeg is available, offer a local merge action such as `Vídeo + áudio` without re-encoding when remuxing is sufficient.

MP3/MP4 conversion actions are enabled only when the required local FFmpeg capability is present. The UI explains disabled conversion instead of presenting unexplained grey buttons.

The downloader must not bypass DRM or protected encrypted streams.

## 7. Dock/panel architecture

AI, Watch Together, Media and other side tools use a shared dock manager. Exactly one right-side dock owns reserved width at a time unless a future design explicitly supports split docks.

The renderer requests a dock mode and width; the main process uses the same state to resize the active WebContentsView. Native page surfaces must never overlap a dock.

Opening/closing a dock, resizing the window, compacting tabs and switching tabs must recompute bounds deterministically.

## 8. Support integration

Add one discreet heart/support entry in the lower sidebar and a small entry in About. No popups, badges, periodic reminders, auto-opening pages, injected website content or flashing UI.

The internal support page lists:

- APOIA.se: https://apoia.se/marshmallow-browser
- Ko-fi: https://ko-fi.com/marshmallowbrowser
- Buy Me a Coffee: https://buymeacoffee.com/marshmallowbrowser

The official site receives a corresponding support section/page using the same restrained presentation.

## 9. Update/download experience

About checks the official release metadata and shows current/update-available state. The user chooses whether to download; 5.0 does not introduce silent self-update.

The update flow points to the official GitHub Release installer and surfaces the published SHA-256. A downloaded installer is only presented as verified when its computed SHA-256 matches release metadata.

The site and in-browser update view must refer to the same release/version metadata to avoid divergent links.

## 10. Security and compatibility constraints

Keep context isolation and existing Electron security boundaries. Do not weaken sandbox/security globally to make individual games work.

Per-site exceptions must be narrow, explicit and persisted locally. No Flash runtime is added.

Game Mode is not a blanket permission bypass and does not disable same-origin, DRM, TLS or Chromium security protections.

Support links do not collect browsing behavior.

## 11. Regression fixes required from 4.1.0

5.0 cannot be declared release-ready unless all of these are verified:

1. toolbar tools remain visible and never spill into a hidden second row;
2. autocomplete displays candidates reliably on first focus/type and keyboard navigation works;
3. media/download dock is fully visible and never covered by the page WebContentsView;
4. a page with known video traffic is not misrepresented as audio-only when video requests/streams are observable;
5. normal browsing, tabs, bookmarks, private browsing, extensions and Watch Together still operate after the layout/runtime changes;
6. session restore behavior remains intact.

## 12. Verification strategy

Automated/static checks:

- TypeScript typecheck;
- Vite production build;
- Node syntax checks for Electron/preload/backend scripts;
- focused unit tests for omnibox candidate generation, media classification/deduplication and Game Mode policy resolution;
- geometry tests for toolbar/dock bound calculations;
- secret-pattern and unsafe-Electron-preference scans;
- package/version/release metadata consistency checks.

Runtime smoke tests on Windows build:

- normal navigation and history menu;
- autocomplete from empty history and populated history;
- open/close media dock at multiple window sizes;
- YouTube or another adaptive-streaming site to verify audio/video classification without DRM circumvention;
- at least one representative HTML5/WebGL browser game for Game Mode, fullscreen, pointer/keyboard behavior and background execution;
- Game Mode per-site persistence and resource-saving override;
- extensions, private browsing and session restore;
- installer creation, launch, uninstall/reinstall sanity;
- update metadata and SHA-256 verification.

Publication is blocked if required runtime checks cannot be executed or fail.

## 13. Release packaging/publication

Version all application, site and public-release metadata as 5.0.0.

Produce:

- Windows NSIS installer;
- SHA-256 text file;
- 5.0.0 release notes/changelog;
- updated official site assets and release.json/version metadata;
- public GitHub release package;
- publication/diagnostic scripts that fail loudly and do not claim success without verifying the resulting GitHub Release and public site.

The final release title is `MarshMallow 5.0.0` and creator/developer attribution remains Deivison Santos / @devsaex.

## Non-goals for 5.0

- Chromium engine fork;
- Flash support;
- silent background updates;
- DRM circumvention;
- unrestricted auto-granting of device permissions;
- intrusive monetization or support prompts.

## Amendment — Standard Downloads + MarshMallow Downloader Manager integration

MarshMallow 5.0.0 keeps a fully functional built-in browser download manager as the default. The browser must not depend on the future MarshMallow Downloader Manager for ordinary downloads.

The built-in manager owns Chromium/Electron `DownloadItem` lifecycle and exposes active/recent downloads with filename, source, received/total bytes, progress, state, pause/resume/cancel, open file and show-in-folder actions. Completed/interrupted history is persisted locally with a bounded retention policy and can be cleared by the user.

The toolbar download entry opens one unified Black Piano download dock with two views: `Downloads` and `Mídia da página`. This prevents the media detector from being confused with the browser's normal download manager while preserving the 5.0 media tooling.

Settings → Downloads includes a `MarshMallow Downloader Manager` integration card. In 5.0 the integrated browser manager remains selected by default. Availability of the standalone manager is read from the official `https://marshmallow-browser-br.pages.dev/download/manager.json` metadata endpoint. While unavailable, the UI shows `Em desenvolvimento` and does not expose a dead download link. When the metadata later becomes available, the same UI exposes the official installer link and the optional integration choice.

The reserved external integration contract is `marshmallow-downloader://add?...`. Selecting the standalone manager is always opt-in. If the external protocol cannot be opened, MarshMallow falls back to its built-in manager instead of losing the requested download. No normal download is silently discarded.
