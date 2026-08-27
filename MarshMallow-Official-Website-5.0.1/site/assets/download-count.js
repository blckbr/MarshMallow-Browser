const RELEASES_API = 'https://api.github.com/repos/blckbr/MarshMallow-Browser/releases';
const CACHE_KEY = 'marshmallow:official-download-count:v1';
const CACHE_TTL_MS = 15 * 60 * 1000;
const OFFICIAL_INSTALLER_RE = /^MarshMallow-Setup-\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?\.exe$/i;

export function isOfficialInstallerName(name) {
  return OFFICIAL_INSTALLER_RE.test(String(name || ''));
}

export function sumOfficialDownloads(releases) {
  if (!Array.isArray(releases)) return 0;
  let total = 0;
  for (const release of releases) {
    for (const asset of Array.isArray(release?.assets) ? release.assets : []) {
      if (!isOfficialInstallerName(asset?.name)) continue;
      const count = Number(asset?.download_count);
      if (Number.isFinite(count) && count > 0) total += count;
    }
  }
  return total;
}

function readCache(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.total) || !Number.isFinite(parsed?.savedAt)) return null;
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    return parsed.total;
  } catch { return null; }
}

function writeCache(total, storage = globalThis.localStorage) {
  try { storage?.setItem(CACHE_KEY, JSON.stringify({ total, savedAt: Date.now() })); } catch {}
}

export async function fetchCumulativeOfficialDownloads(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch indisponível.');
  const releases = [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await fetchImpl(`${RELEASES_API}?per_page=100&page=${page}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Resposta inesperada da API do GitHub.');
    releases.push(...batch);
    if (batch.length < 100) break;
  }
  return sumOfficialDownloads(releases);
}

function formatTotal(total) {
  return new Intl.NumberFormat('pt-BR').format(total);
}

function render(total, state = 'ok') {
  if (typeof document === 'undefined') return;
  for (const host of document.querySelectorAll('[data-download-counter]')) {
    const value = host.querySelector('[data-download-counter-value]');
    const status = host.querySelector('[data-download-counter-status]');
    if (value) value.textContent = state === 'ok' ? formatTotal(total) : '—';
    if (status) status.textContent = state === 'ok'
      ? 'downloads oficiais acumulados no GitHub'
      : 'contador temporariamente indisponível';
    host.dataset.counterState = state;
  }
}

export async function initDownloadCounter() {
  const cached = readCache();
  if (cached !== null) render(cached, 'ok');
  try {
    const total = await fetchCumulativeOfficialDownloads();
    writeCache(total);
    render(total, 'ok');
    return total;
  } catch (error) {
    console.warn('[MarshMallow] contador de downloads indisponível:', error);
    if (cached === null) render(0, 'unavailable');
    return cached;
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void initDownloadCounter(), { once: true });
  else void initDownloadCounter();
}
