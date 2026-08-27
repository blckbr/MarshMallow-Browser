const COUNT_API = 'https://marshmallow-gateway.marshmallow-browser-br.workers.dev/api/downloads/count';
const CACHE_KEY = 'marshmallow:official-download-count:v2';
const CACHE_TTL_MS = 60 * 1000;

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

export async function fetchOfficialDownloadCount(fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch indisponível.');
  const response = await fetchImpl(`${COUNT_API}?t=${Date.now()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Contador HTTP ${response.status}`);
  const payload = await response.json();
  const total = Number(payload?.total);
  if (payload?.ok !== true || !Number.isFinite(total) || total < 0) throw new Error('Resposta inválida do contador.');
  return Math.floor(total);
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
      ? 'downloads oficiais registrados pelo MarshMallow'
      : 'contador temporariamente indisponível';
    host.dataset.counterState = state;
  }
}

export async function initDownloadCounter() {
  const cached = readCache();
  if (cached !== null) render(cached, 'ok');
  try {
    const total = await fetchOfficialDownloadCount();
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
