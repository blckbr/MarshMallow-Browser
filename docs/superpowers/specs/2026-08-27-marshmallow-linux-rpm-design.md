# MarshMallow Browser 5.0.2 Linux RPM / AppImage Design

**Status:** Approved on 2026-08-27  
**Project attribution:** Deivison Santos / @devsaex

## Goal

Create an official x86_64 Linux edition of MarshMallow Browser 5.0.2 for Fedora, Ultramarine, Red Hat Enterprise Linux, Rocky Linux and AlmaLinux, while keeping the Windows distribution intact.

## Distribution

- Primary artifact: `MarshMallow-Browser-5.0.2-x86_64.rpm`
- Secondary artifact: `MarshMallow-Browser-5.0.2-x86_64.AppImage`
- Stable application ID: `com.devsaex.marshmallow`
- Linux executable name: `marshmallow-browser`
- No automatic replacement of the user's default browser during installation.

## Platform isolation

Windows-only runtime behavior must never execute on Linux. PowerShell, Registry APIs, MSIX/AppX, `.exe` helpers, `C:\...` assumptions and Windows Settings URIs stay behind Windows guards. Linux uses Electron/freedesktop behavior and xdg utilities where needed.

The Windows packaging config is extended, not replaced.

## Linux runtime behavior

- Support X11 and Wayland through Electron/Chromium.
- Do not hard-code GNOME or KDE.
- Use the Linux downloads path from Electron.
- External native-browser fallback uses the Linux system browser, with Chrome/Edge detection only when actually installed.
- Explicit user action may register MarshMallow as the default HTTP/HTTPS browser using freedesktop/xdg mechanisms.
- Register `marshmallow://` through package desktop integration.
- Windows-only desktop/lock-screen wallpaper actions are hidden on Linux.
- New-tab wallpaper remains a new-tab-only feature and must never leak behind web pages, omnibox suggestions or internal pages.
- The updater must never download a Windows `.exe` on Linux; the first Linux release uses RPM/AppImage release workflow instead of silent self-update.
- Extension ZIP extraction/packing must have a Linux implementation and must preserve path-traversal and archive-size safety checks.
- FFmpeg discovery uses `ffmpeg` and `which` on Linux, and Linux-facing messages must not instruct users to install Windows executables.
- DRM is not bypassed and proprietary DRM components are not redistributed without rights.

## Shared features

Keep platform-neutral features working: tabs, vertical tabs, session restore, history, favorites, omnibox, search engines, themes, new-tab wallpaper, settings, PDF Reader, extensions supported by Electron, downloads, built-in download manager, AI panel, Watch Together, media playback, fullscreen, shortcuts, context menus, accounts/authentication flow and privacy settings.

If a feature is Windows-only, Linux must either get a native implementation or a clear disabled/unsupported state instead of a crash.

## Packaging and desktop integration

Electron Builder will be extended with Linux `rpm` and `AppImage` targets. Linux resources include PNG icons and desktop metadata. The RPM must be installable/removable through DNF/RPM without disabling SELinux or Electron sandboxing.

No normal installation path may require `--no-sandbox`, root application execution, world-writable directories or disabled SELinux.

## Validation

The release process must include:

1. TypeScript and Node syntax checks.
2. Existing platform-neutral tests.
3. Linux platform-contract tests that prevent Windows-only runtime leakage.
4. Package metadata tests for RPM/AppImage configuration.
5. Linux build scripts and artifact inspection.
6. Runtime smoke test under a Linux display or Xvfb when available.
7. SHA-256 manifest.
8. `RELATORIO-VALIDACAO-LINUX.txt` stating exactly what was and was not executed.

No claim of physical RHEL/Ultramarine hardware testing is allowed without such a test.

## Expected release files

- `MarshMallow-Browser-5.0.2-x86_64.rpm`
- `MarshMallow-Browser-5.0.2-x86_64.AppImage`
- `MarshMallow-Browser-5.0.2-Linux-Source.zip`
- `SHA256SUMS.txt`
- `RELATORIO-VALIDACAO-LINUX.txt`
- `INSTALAR-MARSHMALLOW-RHEL.txt`

If an artifact cannot be built in the available environment, it must not be fabricated; the report must name the exact blocker.

## Initial scope exclusions

ARM64, DEB, Flatpak, Snap, hosted RPM repository, automatic RPM repository updates, proprietary DRM redistribution, Wine fallback and a Linux port of any separate Windows-only Downloader Manager are separate future projects.
