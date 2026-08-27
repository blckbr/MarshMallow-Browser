import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const installerPath = path.join(root, 'scripts', 'install-pdf-reader.ps1');
const installer = fs.readFileSync(installerPath, 'utf8');

test('PDF Reader installer normalizes Windows paths with Char separators', () => {
  assert.doesNotMatch(
    installer,
    /TrimEnd\('\\\\','\/'\)/,
    'a two-character "\\\\" string cannot be converted to System.Char by PowerShell TrimEnd',
  );
  assert.match(installer, /\[System\.IO\.Path\]::DirectorySeparatorChar/);
  assert.match(installer, /\[System\.IO\.Path\]::AltDirectorySeparatorChar/);
});

test('PDF Reader installer applies its corrected PowerShell script to the target project', () => {
  assert.match(
    installer,
    /'scripts\/install-pdf-reader\.ps1'/,
    'the corrected installer script must be copied into the target before the regression suite runs',
  );
});



test('PDF Reader installer removes editor-only files and pdf-lib', () => {
  assert.match(installer, /src\/pdf\/PdfEditorPage\.tsx/);
  assert.match(installer, /pdf-reader-editor-design\.md/);
  assert.match(installer, /pdf-reader-editor\.md/);
  assert.match(installer, /npm uninstall pdf-lib/);
  assert.match(installer, /pdfjs-dist@4\.10\.38/);
  assert.doesNotMatch(installer, /pdf-lib@1\.17\.1/);
  assert.match(installer, /Tentando restaurar dependencias/);
  assert.match(installer, /npm\.cmd install --no-audit --no-fund/);
});
