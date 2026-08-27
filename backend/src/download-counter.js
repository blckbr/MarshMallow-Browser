export const OFFICIAL_RELEASES_API = 'https://api.github.com/repos/blckbr/MarshMallow-Browser/releases';
export const OFFICIAL_INSTALLER_RE = /^MarshMallow-Setup-\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\.exe$/i;
export const DOWNLOAD_DEDUPE_MS = 10 * 60 * 1000;
export const DOWNLOAD_COOKIE = 'mm_dl_last';

export function isOfficialInstallerName(name) {
  return OFFICIAL_INSTALLER_RE.test(String(name || ''));
}

export function sumLegacyOfficialDownloads(releases) {
  if (!Array.isArray(releases)) return 0;
  let total = 0;
  for (const release of releases) {
    for (const asset of Array.isArray(release?.assets) ? release.assets : []) {
      if (!isOfficialInstallerName(asset?.name)) continue;
      const count = Number(asset?.download_count);
      if (Number.isFinite(count) && count > 0) total += Math.floor(count);
    }
  }
  return total;
}

export function isLikelyBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return true;
  return /bot|crawler|spider|slurp|bingpreview|headless|facebookexternalhit|whatsapp|telegrambot|discordbot|curl\/|wget\//i.test(ua);
}

export function cookieValue(cookieHeader, name) {
  const target = `${String(name || '').trim()}=`;
  if (!target || target === '=') return '';
  for (const part of String(cookieHeader || '').split(';')) {
    const item = part.trim();
    if (item.startsWith(target)) return decodeURIComponent(item.slice(target.length));
  }
  return '';
}

export function shouldCountDownload({ method = 'GET', userAgent = '', cookieHeader = '', now = Date.now() } = {}) {
  if (String(method).toUpperCase() !== 'GET') return false;
  if (isLikelyBot(userAgent)) return false;
  const last = Number(cookieValue(cookieHeader, DOWNLOAD_COOKIE));
  if (Number.isFinite(last) && last > 0 && now - last >= 0 && now - last < DOWNLOAD_DEDUPE_MS) return false;
  return true;
}

export function downloadCountCookie(now = Date.now()) {
  const maxAge = Math.ceil(DOWNLOAD_DEDUPE_MS / 1000);
  return `${DOWNLOAD_COOKIE}=${Math.floor(Number(now) || Date.now())}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function isOfficialGithubInstallerUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') return false;
    return /^\/blckbr\/MarshMallow-Browser\/releases\/download\/v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\/MarshMallow-Setup-\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\.exe$/i.test(url.pathname);
  } catch {
    return false;
  }
}
