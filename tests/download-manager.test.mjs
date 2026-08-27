import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExternalManagerProtocolUrl,
  normalizeDownloadRecord,
  trimDownloadHistory,
  validateDownloaderManagerManifest,
} from '../electron/lib/download-manager.mjs';

test('download progress is clamped and active records expose controls', () => {
  const item = normalizeDownloadRecord({
    id: 'd1',
    url: 'https://example.test/file.zip',
    filename: 'file.zip',
    state: 'progressing',
    receivedBytes: 75,
    totalBytes: 100,
    startedAt: 10,
    updatedAt: 20,
  });
  assert.equal(item.progress, 75);
  assert.equal(item.canPause, true);
  assert.equal(item.canResume, false);
  assert.equal(item.canCancel, true);
});

test('paused downloads can resume but cannot pause again', () => {
  const item = normalizeDownloadRecord({ id:'d2', state:'paused', receivedBytes:10, totalBytes:100 });
  assert.equal(item.canPause, false);
  assert.equal(item.canResume, true);
  assert.equal(item.canCancel, true);
});

test('download history retention is bounded and keeps newest entries', () => {
  const input = Array.from({length:5}, (_, index) => normalizeDownloadRecord({ id:String(index), state:'completed', updatedAt:index + 1 }));
  const result = trimDownloadHistory(input, 3);
  assert.deepEqual(result.map((x) => x.id), ['4','3','2']);
});

test('standalone downloader manifest may be explicitly unavailable without a dead URL', () => {
  const result = validateDownloaderManagerManifest({
    available:false,
    version:'0.0.0',
    url:'',
    protocol:'marshmallow-downloader',
  });
  assert.equal(result.ok, true);
  assert.equal(result.available, false);
  assert.equal(result.url, '');
});

test('available standalone downloader requires official github release URL', () => {
  const result = validateDownloaderManagerManifest({
    available:true,
    version:'1.0.0',
    url:'https://github.com/blckbr/MarshMallow-Downloader-Manager/releases/download/v1.0.0/MarshMallow-Downloader-Manager-Setup-1.0.0.exe',
    protocol:'marshmallow-downloader',
  });
  assert.equal(result.ok, true);
  assert.equal(result.available, true);
});

test('standalone downloader rejects foreign hosts when available', () => {
  const result = validateDownloaderManagerManifest({
    available:true,
    version:'1.0.0',
    url:'https://example.test/manager.exe',
    protocol:'marshmallow-downloader',
  });
  assert.equal(result.ok, false);
});

test('protocol handoff only accepts http or https downloads', () => {
  const ok = buildExternalManagerProtocolUrl({ url:'https://cdn.example/file.zip?x=1', filename:'file.zip' });
  assert.match(ok, /^marshmallow-downloader:\/\/add\?/);
  assert.equal(new URL(ok).searchParams.get('url'), 'https://cdn.example/file.zip?x=1');
  assert.equal(buildExternalManagerProtocolUrl({ url:'file:///C:/secret.txt', filename:'secret.txt' }), '');
});

test('private download flag survives normalization for non-persistent handling', () => {
  const item = normalizeDownloadRecord({ id:'p1', state:'completed', private:true });
  assert.equal(item.private, true);
});

test('interrupted download may expose resume when Chromium says it can resume', () => {
  const item = normalizeDownloadRecord({ id:'i1', state:'interrupted', canResume:true });
  assert.equal(item.canResume, true);
  assert.equal(item.canCancel, false);
});
