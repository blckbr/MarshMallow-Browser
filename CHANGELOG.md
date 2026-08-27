## 5.0.2 — trusted pop-ups, wallpaper isolation and persistent download counter

- Keep wallpapers exclusive to the internal New Tab page.
- Add per-site trusted pop-up permissions while preserving Smart blocking for unknown sites.
- Move the public download counter from live GitHub asset summing to Cloudflare Durable Object persistence.
- Route official website downloads through the Gateway before redirecting to GitHub.
- Never clobber an already-published 5.0.2 Release asset.

# Changelog

## 5.0.1 — PDF Reader, private-window isolation and publishing

- Adds a PDF.js-based PDF Reader for web and local PDF files.
- Adds lazy thumbnails, text search, zoom, fit controls, print and save-copy workflows.
- Keeps PDF handling Reader-only; no PDF editor is advertised.
- Consolidates normal/private BrowserContext isolation for fullscreen, menus and Watch Together.
- Adds a cumulative official GitHub Release download counter to the website.
- Keeps release publication gated by build, runtime smoke test and SHA-256 matching.

## 5.0.0 — Navigation, Game Mode, adaptive media and reliability

- Brave-style Back/Forward navigation history menus.
- Single-row responsive toolbar and repaired omnibox readiness.
- Per-domain Game Mode and background scheduler.
- GPU/WebGL performance diagnostics.
- Deterministic native dock geometry.
- MIME-aware audio/video/HLS/DASH media detection and optional FFmpeg merging.
- DRM-safe media handling, discreet support integration and verified update metadata.

## 4.1.0 — Extensions, Developer Mode, Media & Hardening

- Adds `marshmallow://extensions` and persistent extension registry.
- Adds unpacked, ZIP, CRX and HTTPS-source installation workflows.
- Adds Developer Mode, file URL access, reload/remove/pack controls and compatibility diagnostics.
- Adds F12/Ctrl+Shift+I DevTools and Ctrl+Shift+E extension manager shortcut.
- Adds media-source detection and direct downloads; optional FFmpeg conversion enables MP3/MP4 for technically reusable sources.
- Does not bypass DRM or other content protection.
- Improves Windows wallpaper conversion for Chromium-decodable WebP/AVIF.
- Hardens shell navigation, archive extraction, download collision handling, Watch Together capture cleanup, authentication and backend payload handling.

## 4.0.13 — Windows Wallpaper + AI RAM Tools

- Adds one-click download of the wallpaper currently displayed on the new-tab page.
- Adds Windows desktop-wallpaper integration using the user profile's desktop personalization.
- Adds Windows lock-screen integration using the Windows user-profile personalization API when supported by the system/policy.
- Converts the selected wallpaper to a local high-quality JPEG before handing it to Windows, including bundled WebP and online photographic wallpapers.
- Adds a local **De qual aba vem o som?** tool to MarshMallow AI, listing tabs that are currently emitting audible audio.
- Adds a local **Diminuir consumo de RAM** tool that suspends background web pages while keeping the current tab active.
- Suspended tabs stay in the tab strip and automatically reload when selected.
- Does not suspend the active Watch Together capture tab.
- Preserves the 4.0.12 premium wallpaper engine, persistent profile and session restoration.

## 4.0.12 — Premium Wallpapers + Session Restore

- Rebuilds the new-tab wallpaper experience around four explicit modes: no image, fixed, daily, and random on every new tab.
- Adds a curated high-resolution photographic collection and keeps it opt-in; it contacts Unsplash only when selected.
- Adds 12 bundled MarshMallow Studio wallpapers as an offline collection and fallback.
- Randomizes gallery order and adds a one-click “Surpreenda-me” workflow.
- Uses lower-resolution online thumbnails and loads the full-size photo only when it becomes the active wallpaper.
- Keeps the blank new-tab page truly blank until the user chooses to personalize it; the full picker no longer opens automatically.
- Preserves user-uploaded wallpapers, intensity and blur controls.
- Preserves 4.0.11 tab restoration and local crash-recovery snapshots; private tabs remain excluded.

## 4.0.11 — Restore Tabs + Wallpaper Center

- Adds an explicit “keep tabs open after restart” control under Startup settings.
- Normal tabs are saved locally and restored; private tabs are excluded.
- Session snapshots are refreshed during browsing for better recovery after unexpected shutdowns.
- Adds wallpaper selection/removal controls to the new-tab page and Settings > Appearance.


## 4.0.10 — Startup Lock + Dynamic Dev Port

- Prevents multiple MarshMallow instances from competing for the same persistent Chromium profile.
- Adds a Windows single-instance lock and focuses the existing window when a second instance is requested.
- Development launcher now chooses a free local Vite port between 1421 and 1440 instead of failing when 1421 is occupied.
- Startup cleanup targets only stale MarshMallow development processes from the same project directory and preserves cookies, history and browsing data.
- Fixes the Vite native-config warning by replacing `__dirname` with `import.meta.dirname`.
- Preserves the 4.0.9 background-media guard.

## 4.0.9 — Background Media Wait

- New tabs opened in the background can finish loading without playing HTML5 video/audio before their first activation.
- Background media is temporarily muted and paused to avoid sound or playback progression before the user opens the tab.
- On first activation, the temporary guard is released and pending playback may continue.
- After the first activation, switching away does not automatically pause media the user has already chosen to play.
- Manual tab mute remains independent from the temporary background-media guard.
- Adds a default-on performance setting to enable/disable this behavior.

## 4.0.8 — Safer Tab Controls

- Moves the close-tab control to the upper-right corner of each vertical tab.
- Moves the audio/mute control to the lower-right corner when audio is present.
- Reserves a right-side control rail so tab titles do not overlap the controls.
- Keeps compact-tab behavior while increasing separation between mute and close actions.
- Reduces accidental tab closes when the user intends to mute/unmute audio.

## 4.0.7 — Native Omnibox Overlay

- Fixes smart address suggestions being visually hidden behind site content rendered in Electron `WebContentsView`.
- Moves the autocomplete dropdown to a dedicated native overlay view above the active page instead of relying on CSS `z-index`.
- Suggestions now float over YouTube/video/content without pushing the page downward.
- Empty suggestion panels are not shown.
- Preserves keyboard navigation and `Esc` URL restoration from 4.0.6.

## 4.0.6 — Omnibox Escape Restore

- Pressing `Esc` while editing the address bar discards uncommitted text and restores the real URL of the active tab.
- Works after deleting the entire URL, replacing it with another address, or filling a smart suggestion with `Tab`.
- On `marshmallow://newtab`, `Esc` restores the intentionally empty address field.
- The suggestion popup closes and focus leaves the address bar after restoration.

## 4.0.5 — Clean New Tab + Wallpaper

- Replaces the old Google default new-tab/home target with an internal `marshmallow://newtab` page.
- New tabs start visually clean, with an empty address field and no website loaded in the content area.
- User-selected wallpaper is displayed directly on the new-tab page.
- When no wallpaper is configured, MarshMallow shows a discreet personalization suggestion with direct wallpaper selection and Themes access.
- Existing installs still using the historical Google default are migrated automatically; custom new-tab/home URLs remain configurable.
- Smart omnibox suggestions from 4.0.4 remain available from the clean new tab.

## 4.0.4 — Smart Omnibox + Spellcheck

- Adds local smart address-bar suggestions from browsing history, bookmarks and open tabs.
- Ranking considers domain/title match, recency, visit frequency, bookmarks and already-open tabs.
- Adds keyboard navigation: Up/Down, Tab to fill, Enter to open.
- Normal history capacity increased to 1000 unique URLs with visit counters used by ranking.
- Private tabs do not use normal-history suggestions.
- Adds Chromium spell-check correction suggestions to editable-field context menus.
- Users can replace misspelled words or add them to the local spell-check dictionary.
- Preserves the persistent profile/cookie manager work from the 4.0.x line.

## 4.0.3 — Persistent Cookies + Login Compatibility

- Persistent Chromium profile and explicit cookie flush on shutdown.
- Cookie manager with encrypted export/import.
- Storage Access permissions for modern authentication flows.

## 4.0.2 — In-browser Sign-in

- Site-initiated Google/YouTube/Microsoft/Apple sign-in stays inside MarshMallow by default.
- Native-browser handoff remains a manual compatibility option only.

## 4.0.1 — Google Compatibility Test

- Removed global User-Agent spoofing for Google compatibility diagnostics.

## 4.0.0 — Native Compatibility Core

- Starts the MarshMallow 4.x browser-engine migration.
- Protected Google/Microsoft/Apple authentication endpoints can be handed to a real desktop browser instead of an embedded Chromium view.
- Microsoft Edge is preferred by default, with Chrome and the Windows default browser available.
- Adds **Settings → Compatibility**.
- Adds **Open in native browser** to the page context menu.
- Preserves MarshMallow AI, Watch Together, vertical tabs, themes, history/bookmarks, fullscreen fixes, local accounts, recovery, and the Black Piano UI.
- Does not spoof User-Agent, bypass CAPTCHA, copy Chrome/Edge cookies, or automate credentials.

## 3.3.x

Previous public line: settings center, fullscreen fixes, internal tabs, AI/chat improvements, creator record, Google verification guard, and editable-text context menu.
