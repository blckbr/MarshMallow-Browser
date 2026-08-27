const DOWNLOAD_STATES = new Set(['progressing', 'paused', 'completed', 'cancelled', 'interrupted']);

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeDownloadRecord(input = {}) {
  const totalBytes = Math.max(0, safeNumber(input.totalBytes));
  const receivedBytes = Math.max(0, safeNumber(input.receivedBytes));
  const state = DOWNLOAD_STATES.has(String(input.state)) ? String(input.state) : 'interrupted';
  const rawProgress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : state === 'completed' ? 100 : 0;
  const progress = Math.max(0, Math.min(100, Math.round(rawProgress * 10) / 10));
  const progressing = state === 'progressing';
  const paused = state === 'paused';
  return {
    id: String(input.id || ''),
    url: String(input.url || ''),
    filename: String(input.filename || 'download'),
    savePath: String(input.savePath || ''),
    state,
    receivedBytes,
    totalBytes,
    progress,
    startedAt: Math.max(0, safeNumber(input.startedAt)),
    updatedAt: Math.max(0, safeNumber(input.updatedAt)),
    private: Boolean(input.private),
    canPause: progressing,
    canResume: paused || Boolean(input.canResume),
    canCancel: progressing || paused,
    canOpen: state === 'completed' && Boolean(input.savePath),
    canShow: Boolean(input.savePath),
  };
}

export function trimDownloadHistory(records = [], maxItems = 200) {
  const limit = Math.max(0, Math.floor(safeNumber(maxItems, 200)));
  return (Array.isArray(records) ? records : [])
    .map((item) => normalizeDownloadRecord(item))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function validateDownloaderManagerManifest(json) {
  const available = json?.available === true;
  const version = String(json?.version || '').trim();
  const url = String(json?.url || '').trim();
  const protocol = String(json?.protocol || '').trim().toLowerCase();
  if (protocol !== 'marshmallow-downloader') return { ok:false, available, version, url, protocol, error:'protocol-invalid' };
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) return { ok:false, available, version, url, protocol, error:'version-invalid' };
  if (!available) return { ok:true, available:false, version, url:'', protocol };
  let parsed;
  try { parsed = new URL(url); } catch { return { ok:false, available, version, url, protocol, error:'url-invalid' }; }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com') return { ok:false, available, version, url, protocol, error:'url-host-invalid' };
  const expectedPath = `/blckbr/MarshMallow-Downloader-Manager/releases/download/v${version}/MarshMallow-Downloader-Manager-Setup-${version}.exe`;
  if (parsed.pathname !== expectedPath) return { ok:false, available, version, url, protocol, error:'url-path-invalid' };
  return { ok:true, available:true, version, url, protocol };
}

export function buildExternalManagerProtocolUrl(input = {}) {
  const rawUrl = String(input.url || '').trim();
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return ''; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  const target = new URL('marshmallow-downloader://add');
  target.searchParams.set('url', parsed.href);
  const filename = String(input.filename || '').trim().slice(0, 240);
  if (filename) target.searchParams.set('filename', filename);
  return target.href;
}
