# MarshMallow 3.0.4 — Electron Media Permission Fix

O diagnóstico da 3.0.3 mostrou:

- LiveKit conectou;
- `capture-request` foi iniciado;
- `getDisplayMedia()` terminou com `NotAllowedError: Permission denied`;
- `display-request` NÃO apareceu.

Isso significa que Chromium negou a permissão antes de chamar
`setDisplayMediaRequestHandler()`.

## Causa

A sessão permitia:
- `display-capture`

mas negava:
- `media`

O Watch Publisher solicita `video + audio`. Electron trata `media` como uma
permissão separada.

## Correção

`display-capture` e `media` são agora permitidas somente quando o
`webContents.id` pertence à janela interna Watch Publisher.

As páginas normais das abas NÃO recebem essa permissão automaticamente.

O PowerShell também mostra:
- `[Permission check]`
- `[Permission request]`
- `[DisplayMedia]`

para sabermos exatamente quais permissões o Chromium consultou.
