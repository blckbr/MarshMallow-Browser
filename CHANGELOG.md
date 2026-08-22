# Changelog

## 4.0.11 — Session Restore + Recovery

- Adds an explicit **Keep tabs open after restarting MarshMallow** option in Settings → Startup.
- Restores up to 50 normal tabs and the previously active tab.
- Restores supported internal MarshMallow pages such as New Tab, Library, Themes and Settings.
- Private tabs are never written to the session file or restored.
- Temporary Google `/sorry/` verification URLs remain excluded from session persistence.
- Session snapshots are refreshed while browsing instead of only during normal shutdown, improving recovery after unexpected exits.
- Uses a temporary session file before replacement to reduce the chance of a partially written session record.

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
