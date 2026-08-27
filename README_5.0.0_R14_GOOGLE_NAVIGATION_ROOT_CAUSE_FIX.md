# MarshMallow 5.0.0 R14 — Google navigation root-cause fix

## Root cause confirmed from Windows diagnostic log

A normal Google result click reached the page DOM and Chromium requested a `currentTab` anchor navigation to the correct external destination. The destination began loading, but MarshMallow's `will-navigate` handler changed the WebContents User-Agent for the target URL while navigation was already in flight. Chromium then restarted/reloaded the current Google document, observed in the diagnostic trace as `reloadBypassingCache`, which cancelled the destination and returned the user to the search results.

## Fix

User-Agent mutation was removed from page navigation lifecycle listeners:

- `will-navigate`
- `will-redirect`
- `did-navigate`
- `did-navigate-in-page`

A normal anchor click is now allowed to proceed without MarshMallow changing WebContents identity mid-navigation. Existing popup protection, native-auth guard, strict media-site navigation guard, downloads, Watch Together and dock behavior remain unchanged.

## Regression test

`tests/user-agent-navigation-stability.test.mjs` fails on R13 and passes on R14. It prevents future navigation lifecycle handlers from calling `setUserAgent()` or `applyCompatibleUserAgent()`.

Verification performed in the build workspace:

- `node --check electron/main.mjs`
- `node --check electron/preload.cjs`
- `node --test tests/*.test.mjs` → 87/87 passing
- `node scripts/verify-5.0.mjs` → passed

The Windows installer/runtime still needs the normal smoke validation on Windows before publication.
