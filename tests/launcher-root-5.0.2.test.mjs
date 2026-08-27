import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const launchers = [
  ['VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.2.bat', 'windows-build-5.0.2.ps1'],
  ['REGISTRAR_SMOKE_5.0.2.bat', 'windows-smoke-5.0.2.ps1'],
  ['PUBLICAR_MARSHMALLOW_5.0.2.bat', 'windows-publish-5.0.2.ps1'],
];

for (const [name, helper] of launchers) {
  test(`${name} cannot mistake the extracted publication package for canonical source`, () => {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(text, /set "TARGET=C:\\MarshMallow-5\.0\.0-Source"/i);
    assert.match(text, /scripts\\windows-smoke-5\.0\.ps1/i);
    assert.match(text, /MarshMallow-Official-Website-5\.0\.0\\site\\download\\manager\.json/i);
    assert.match(text, /set "ROOT=%TARGET%"/i);
    assert.match(text, new RegExp(`set "PS1=%ROOT%\\\\scripts\\\\${helper.replaceAll('.', '\\.')}"`, 'i'));
  });
}
