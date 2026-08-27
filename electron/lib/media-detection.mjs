import crypto from 'node:crypto';

const AUDIO_EXT = /\.(?:mp3|m4a|aac|ogg|opus|flac|wav)(?:$|[?#])/i;
const VIDEO_EXT = /\.(?:mp4|webm|mov|m4v|mkv)(?:$|[?#])/i;
const MANIFEST_EXT = /\.(?:m3u8|mpd)(?:$|[?#])/i;
const SEGMENT_EXT = /\.(?:ts|m4s|cmfv|cmfa|m4f)(?:$|[?#])/i;

function headerFirst(headers, name) {
  const key = Object.keys(headers || {}).find((x) => x.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : null;
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}
function mimeBase(value) { return String(value || '').toLowerCase().split(';',1)[0].trim(); }
function inferContainer(mime, url) {
  if (mime.includes('webm') || /\.webm(?:$|[?#])/i.test(url)) return 'webm';
  if (mime.includes('mp4') || /\.(?:mp4|m4a|m4v)(?:$|[?#])/i.test(url)) return 'mp4';
  if (mime.includes('mpegurl') || /\.m3u8(?:$|[?#])/i.test(url)) return 'hls';
  if (mime.includes('dash+xml') || /\.mpd(?:$|[?#])/i.test(url)) return 'dash';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('opus')) return 'opus';
  return '';
}
function parseCodec(mimeValue) {
  const match = String(mimeValue || '').match(/codecs?\s*=\s*["']?([^;"']+)/i);
  return match ? match[1].trim() : '';
}
function numericParam(urlValue, names) {
  try {
    const u = new URL(urlValue);
    for (const name of names) {
      const value = Number(u.searchParams.get(name) || 0);
      if (Number.isFinite(value) && value > 0) return value;
    }
  } catch {}
  return 0;
}
function resolutionFromUrl(urlValue) {
  try {
    const u = new URL(urlValue);
    const label = u.searchParams.get('quality_label') || u.searchParams.get('quality') || '';
    if (/^\d{3,4}p(?:\d+)?$/i.test(label)) return label;
    const height = numericParam(urlValue, ['height', 'h']);
    return height >= 144 && height <= 8640 ? `${Math.round(height)}p` : '';
  } catch { return ''; }
}
function streamGroupId(urlValue, kind) {
  try {
    const u = new URL(urlValue);
    for (const key of [...u.searchParams.keys()]) {
      if (/^(?:range|rn|rbuf|sq|start|end|segment|frag|part|chunk|ts|expire|sig|signature)$/i.test(key)) u.searchParams.delete(key);
    }
    return `${kind}:${u.hostname}${u.pathname}?${u.searchParams.toString()}`.replace(/\?$/,'');
  } catch { return `${kind}:${String(urlValue || '')}`; }
}
export function classifyMediaObservation(input = {}) {
  const url = String(input.url || '');
  if (!/^https?:\/\//i.test(url)) return null;
  const responseHeaders = input.responseHeaders || {};
  const mime = mimeBase(input.mimeType || headerFirst(responseHeaders,'content-type'));
  const resourceType = String(input.resourceType || '');
  const manifest = mime.includes('mpegurl') || mime.includes('dash+xml') || MANIFEST_EXT.test(url);
  if (!manifest && (SEGMENT_EXT.test(url) || /(?:video|audio)\/(?:mp2t|iso\.segment)/.test(mime))) return null;
  const audio = mime.startsWith('audio/') || AUDIO_EXT.test(url);
  const video = mime.startsWith('video/') || VIDEO_EXT.test(url);
  if (!manifest && !audio && !video && resourceType !== 'media') return null;
  let kind = manifest ? 'manifest' : audio && video ? 'muxed' : audio ? 'audio' : 'video';
  if (!manifest && resourceType === 'media' && !audio && !video) kind = 'muxed';
  const container = inferContainer(mime, url);
  const codec = parseCodec(input.mimeType || headerFirst(responseHeaders,'content-type'));
  const contentLength = Number(input.contentLength || headerFirst(responseHeaders,'content-length') || 0);
  const bitrate = numericParam(url, ['bitrate', 'br', 'abr']);
  const resolution = resolutionFromUrl(url);
  const id = crypto.createHash('sha256').update(`${kind}:${url}`).digest('hex').slice(0,24);
  return {
    id, url, kind, manifest, mimeType:mime || '', container, codec,
    contentLength:Number.isFinite(contentLength) ? contentLength : 0,
    bitrate:Number.isFinite(bitrate) ? bitrate : 0, resolution,
    resourceType, detectedAt:Number(input.detectedAt || Date.now()),
    pageUrl:String(input.pageUrl || ''), direct:true,
    streamGroupId:streamGroupId(url, kind),
    // A resposta `video/*` não prova que o arquivo seja video-only; alguns
    // servidores entregam MP4 já multiplexado. Só declare ausência quando a
    // camada de detecção tiver evidência explícita.
    hasAudio:kind === 'audio' ? true : input.hasAudio === false ? false : input.hasAudio === true ? true : undefined,
    hasVideo:kind === 'video' ? true : kind === 'audio' ? false : input.hasVideo === true ? true : undefined,
    source:String(input.source || 'rede'),
  };
}
export function groupMediaObservations(observations = []) {
  const map = new Map();
  for (const item of Array.isArray(observations) ? observations : []) {
    if (!item) continue;
    const key = String(item.streamGroupId || item.id || `${item.kind}:${item.url}`);
    const current = map.get(key);
    if (!current || Number(item.detectedAt || 0) >= Number(current.detectedAt || 0)) map.set(key, item);
  }
  return [...map.values()].sort((a,b) => Number(b.detectedAt||0) - Number(a.detectedAt||0));
}
export function selectMergePair(items = [], preferredVideoId = '') {
  const list = (Array.isArray(items) ? items : []).filter((x) => x && !x.drm && !x.protected);
  const video = list.find((x) => String(x.id) === String(preferredVideoId) && x.kind === 'video') || list.find((x) => x.kind === 'video');
  if (!video) return null;
  const videoPage = String(video.pageUrl || '');
  const audioCandidates = list.filter((x) => x.kind === 'audio' && (!videoPage || String(x.pageUrl || '') === videoPage));
  audioCandidates.sort((a,b) => (Number(b.bitrate||0)-Number(a.bitrate||0)) || (Number(b.contentLength||0)-Number(a.contentLength||0)) || (Number(b.detectedAt||0)-Number(a.detectedAt||0)));
  const audio = audioCandidates[0] || null;
  return audio ? { video, audio } : null;
}
