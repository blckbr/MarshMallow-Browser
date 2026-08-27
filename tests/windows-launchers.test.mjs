import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const launchers = [
  ['VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.0.bat', 'windows-build-5.0.ps1'],
  ['REGISTRAR_SMOKE_5.0.0.bat', 'windows-smoke-5.0.ps1'],
  ['PUBLICAR_MARSHMALLOW_5.0.0.bat', 'windows-publish-5.0.ps1'],
  ['DIAGNOSTICAR_MARSHMALLOW_5.0.0.bat', 'windows-diagnostic-5.0.ps1'],
];

for (const [launcher, ps1] of launchers) {
  test(`${launcher} locates its PowerShell helper from root or scripts folder`, () => {
    const source = readFileSync(new URL(`../${launcher}`, import.meta.url), 'utf8');
    assert.match(source, new RegExp(`%~dp0scripts\\\\${ps1.replaceAll('.', '\\.')}`, 'i'));
    assert.match(source, new RegExp(`%~dp0${ps1.replaceAll('.', '\\.')}`, 'i'));
    assert.match(source, /PACOTE_5_COMPLETO/i);
    assert.match(source, /for %%I in \("%~dp0\."\) do set "ROOT=%%~fI"/i);
    assert.doesNotMatch(source, /set "ROOT=%~dp0"/i);
  });
}


const helpers = launchers.map(([, ps1]) => ps1);
for (const helper of helpers) {
  test(`${helper} sanitizes the root path before creating log or report paths`, () => {
    const source = readFileSync(new URL(`../scripts/${helper}`, import.meta.url), 'utf8');
    assert.ok(source.includes("$Root = ([string]$Root).Trim().Trim([char[]]'\"')"));
    assert.ok(source.includes('$Root = [IO.Path]::GetFullPath($Root)'));
    assert.ok(source.includes("if ($Root.Length -gt 3) { $Root = $Root.TrimEnd([char[]]'\\/') }"));
  });
}
