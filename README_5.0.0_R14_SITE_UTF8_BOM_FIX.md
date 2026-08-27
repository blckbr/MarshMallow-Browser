# MarshMallow 5.0.0 R14 — correção UTF-8 BOM da publicação

## Sintoma confirmado

O GitHub Release e os assets foram publicados corretamente, e o Cloudflare Pages concluiu o deploy. A verificação final falhou ao ler `version.json` com a mensagem `JSON primitivo inválido: ï.`.

A causa é o comportamento do Windows PowerShell 5.1: `Set-Content -Encoding UTF8` grava UTF-8 com BOM. O `version.json` público começava com os bytes EF BB BF, que no caminho de leitura eram interpretados como `ï»¿` antes do `{`.

## Correção

- `version.json` e `download/release.json` passam a ser gravados por `System.IO.File.WriteAllText` com `UTF8Encoding($false)`, isto é, UTF-8 sem BOM.
- O parser de verificação também remove tanto U+FEFF quanto a representação mojibake `ï»¿` antes de `ConvertFrom-Json`.
- `REPUBLICAR_SITE_5.0.0.bat` republica apenas o site e seus metadados. Não faz push, não cria release e não reenvia o instalador.

## Agora

Copie este patch sobre a pasta do R14 e execute somente:

`REPUBLICAR_SITE_5.0.0.bat`

Digite `SITE` quando solicitado.

Depois do deploy, o próprio script verifica `version.json` e `download/release.json` no domínio público.
