# MarshMallow Browser

MarshMallow is a Windows-first desktop web browser with a Black Piano interface, vertical tabs, browser organization, integrated AI, Watch Together, modern browser-game support and local media tools.

## Official links

- Website: https://marshmallow-browser-br.pages.dev/
- Download: https://marshmallow-browser-br.pages.dev/download/
- Support: https://marshmallow-browser-br.pages.dev/apoie/
- Creator credit: see `AUTHORS.md`

## Current public version

The current release line prepared by this record is **MarshMallow 5.0.x**.

This repository is the **official public project record** for MarshMallow. It intentionally does **not** publish the complete proprietary source code.

## Main features

- Vertical tabs, groups, session restore and crash-recovery snapshots
- Back/Forward history menus sourced from the tab's real Chromium navigation history
- Address-bar autocomplete from local history, favorites and open tabs
- MarshMallow AI
- Watch Together
- PDF Reader based on PDF.js for web/local documents, lazy thumbnails, search, zoom, print and save copy
- Game Mode per domain for modern HTML5/WebGL/WebAssembly browser games
- Background-execution scheduler with per-site resource-saving preference
- Factual GPU/WebGL/WebGL2/Canvas/Gamepad diagnostics
- Bookmarks and history
- Built-in download manager with progress, pause, resume, cancel, history and Ctrl+J
- Optional MarshMallow Downloader Manager integration reserved through official metadata; the browser remains independent when it is not installed
- Themes, wallpapers and Black Piano customization
- Chromium extension manager with Developer Mode and external HTTPS package support
- Media detector using network MIME metadata plus page observations
- Audio/video/HLS/DASH classification and MediaSource awareness
- Local video + audio merge when separate compatible streams are exposed and FFmpeg is available
- Optional local MP3/MP4 conversion when FFmpeg is available
- Protected DRM media is never decrypted or bypassed
- F12 / Ctrl+Shift+I developer tools
- Private tabs
- Fullscreen video support
- Native-style context menus
- Persistent cookie manager with encrypted export/import
- Manual native-browser compatibility option when needed

## MarshMallow 5.0.2

MarshMallow 5.0.2 adds per-site trusted pop-up permissions, confines the custom wallpaper to the real New Tab page, and moves the public download counter to a persistent Cloudflare Durable Object. The counter seeds itself from the official GitHub Release installer counts that are still available, then records future site downloads independently of asset replacement.

The website routes installer clicks through the MarshMallow Gateway and then redirects to the exact official GitHub Release asset. Existing releases are not overwritten by the 5.0.2 publisher.

## MarshMallow 5.0.1

MarshMallow 5.0.1 adds a lightweight integrated PDF Reader while preserving the browser-grade reliability work from 5.0.0. It fixes the hidden-toolbar regression, the first-open autocomplete race and native WebContentsView overlap with side panels. It adds Brave-style navigation-history menus, Game Mode, performance diagnostics, safer release verification, and a media detector that no longer depends on filename extensions alone.

The browser keeps Chromium security boundaries intact. Game Mode is not a blanket permission bypass, support links are voluntary and non-intrusive, and update metadata is pinned to the official MarshMallow GitHub Release path with SHA-256 verification.

The complete proprietary source code is not published in this public record.

## License

MarshMallow is proprietary software unless a file or dependency explicitly states otherwise. See `LICENSE-PROPRIETARY.txt` and `NOTICE.md`.

Copyright © 2026 Deivison Santos. All rights reserved.
