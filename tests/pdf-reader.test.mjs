import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function source(name) { return read(name); }

test('PDF Reader is a first-class internal page and red sidebar tool below Watch Together', () => {
  const types = source('src/types.ts');
  const app = source('src/App.tsx');
  const main = source('electron/main.mjs');
  const css = source('src/styles.css');

  assert.match(types, /InternalPageId[^\n]*"pdf"/);
  assert.match(main, /pdf:\s*\{\s*title:\s*"PDF Reader",\s*url:\s*"marshmallow:\/\/pdf"/s);
  const watch = app.indexOf('title="Watch Together"');
  const pdf = app.indexOf('title="PDF Reader"');
  assert.ok(watch >= 0 && pdf > watch, 'PDF tool must appear after Watch Together');
  assert.match(app, /openInternalPage\("pdf"\)/);
  assert.match(css, /\.pdf-sidebar-tool[^\{]*\{[^}]*#(?:e|f|d|c)[0-9a-f]{5}/i);
});

test('PDF bridge is narrow and sender-context scoped', () => {
  const preload = source('electron/preload.cjs');
  const main = source('electron/main.mjs');
  const types = source('src/types.ts');

  assert.match(preload, /pdf:\s*\{[\s\S]*fetchUrl:[\s\S]*pdf:fetch-url[\s\S]*save:[\s\S]*pdf:save/);
  assert.match(main, /ipcMain\.handle\("pdf:fetch-url",\s*async\s*\(event,\s*url\)/);
  assert.match(main, /contextForWebContents\(event\.sender\)/);
  assert.match(main, /PRIVATE_PARTITION/);
  assert.match(main, /TAB_PARTITION/);
  assert.match(main, /ipcMain\.handle\("pdf:save"/);
  assert.match(types, /pdf:\s*\{[\s\S]*fetchUrl\(url:\s*string\)/);
});

test('PDF Reader is read-only and depends only on PDF.js', () => {
  const pkg = JSON.parse(source('package.json'));
  const app = source('src/App.tsx');
  const reader = source('src/pdf/PdfReaderPage.tsx');
  const engine = source('src/pdf/pdf-engine.ts');

  assert.equal(pkg.dependencies['pdfjs-dist'], '4.10.38');
  assert.equal(pkg.dependencies['pdf-lib'], undefined, 'reader-only build must not ship pdf-lib');
  assert.match(app, /activeInternalPage === "pdf"\s*\?\s*<PdfReaderPage/);
  assert.match(reader, /Faça upload do arquivo/);
  for (const label of ['Abrir PDF', 'Salvar cópia', 'Imprimir', 'Ajustar largura', 'Pesquisar no PDF']) {
    assert.ok(reader.includes(label), `missing PDF reader capability: ${label}`);
  }
  for (const editorLabel of ['Adicionar texto', 'Destacar', 'Desenhar', 'Assinatura', 'Inserir imagem', 'Excluir página', 'Duplicar página', 'Juntar PDF', 'Desfazer', 'Refazer']) {
    assert.ok(!reader.includes(editorLabel), `reader-only UI must not expose editor capability: ${editorLabel}`);
  }
  assert.match(engine, /getDocument/);
  assert.doesNotMatch(engine, /PDFDocument|pdf-lib/);
});

test('web PDF navigation is intercepted by URL and main-frame MIME', () => {
  const main = source('electron/main.mjs');
  assert.match(main, /isPdfUrl\(url\)/);
  assert.match(main, /shouldInterceptPdfResponse\(details\)/);
  assert.match(main, /openPdfInReader\(context,\s*[^,]+,\s*\{/);
  assert.match(main, /callback\(\{\s*cancel:\s*true\s*\}\)/);
});

test('pure PDF routing helpers classify URL and MIME safely', async () => {
  const helperPath = path.join(root, 'electron/lib/pdf-routing.mjs');
  assert.ok(fs.existsSync(helperPath), 'pdf-routing helper must exist');
  const helper = await import(`${pathToFileURL(helperPath).href}?t=${Date.now()}`);
  assert.equal(helper.isPdfUrl('https://example.com/a.pdf'), true);
  assert.equal(helper.isPdfUrl('https://example.com/a.PDF?download=1'), true);
  assert.equal(helper.isPdfUrl('https://example.com/pdf?id=1'), false);
  assert.equal(helper.isPdfMime('application/pdf; charset=binary'), true);
  assert.equal(helper.isPdfMime('text/html'), false);
  assert.equal(helper.shouldInterceptPdfResponse({ resourceType:'mainFrame', responseHeaders:{ 'content-type':['application/pdf'] }, url:'https://e.test/download?id=1' }), true);
  assert.equal(helper.shouldInterceptPdfResponse({ resourceType:'xhr', responseHeaders:{ 'content-type':['application/pdf'] }, url:'https://e.test/a.pdf' }), false);
});

test('one-click PDF Reader installer is guarded by backup rollback and verification gates', () => {
  const bat = source('INSTALAR_PDF_READER_MARSHMALLOW_FIX5.bat');
  const ps1 = source('scripts/install-pdf-reader.ps1');
  assert.match(bat, /MarshMallow-5\.0\.0-PDF-Reader-FIX5\.zip/);
  assert.match(bat, /Expand-Archive/);
  assert.match(ps1, /\.backup-pdf-reader-/);
  assert.match(ps1, /ROLLBACK/);
  assert.match(ps1, /pdfjs-dist@4\.10\.38/);
  assert.match(ps1, /npm uninstall pdf-lib/);
  assert.doesNotMatch(ps1, /pdf-lib@1\.17\.1/);
  assert.match(ps1, /npm run test:unit/);
  assert.match(ps1, /npm run typecheck/);
  assert.match(ps1, /npm run build/);
});

test('PDF reader formats caught unknown errors without direct optional message access', () => {
  const editor = source('src/pdf/PdfReaderPage.tsx');
  assert.doesNotMatch(
    editor,
    /catch\s*\(error\)\s*\{[^}]*error\?\.message/s,
    'TypeScript catch variables are unknown and must be narrowed before reading .message',
  );
});

test('PDF renderer parses each document once and reuses the loaded PDF.js document', () => {
  const engine = source('src/pdf/pdf-engine.ts');
  const editor = source('src/pdf/PdfReaderPage.tsx');
  const getDocumentCalls = (engine.match(/getDocument\s*\(/g) || []).length;
  assert.equal(getDocumentCalls, 1, 'PDF bytes must be parsed by PDF.js only once per loaded document');
  assert.match(engine, /export async function loadPdfDocument/);
  assert.match(editor, /loadPdfDocument\(bytes\)/);
  assert.match(editor, /pdfDocument/);
});

test('PDF thumbnails render lazily instead of rendering up to 200 pages at once', () => {
  const editor = source('src/pdf/PdfReaderPage.tsx');
  assert.match(editor, /IntersectionObserver/);
  assert.match(editor, /rootMargin/);
  assert.match(editor, /visible/);
  assert.doesNotMatch(editor, /renderPdfThumbnail\(bytes,\s*page/);
});


test('PDF Reader layout has only toolbar and workspace rows', () => {
  const css = source('src/styles.css');
  assert.match(css, /\.pdf-reader\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,1fr\)/s);
  assert.doesNotMatch(css, /\.pdf-editbar/);
});
