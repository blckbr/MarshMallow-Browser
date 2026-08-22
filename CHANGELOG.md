# Changelog

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
