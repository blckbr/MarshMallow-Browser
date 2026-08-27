# MarshMallow 3.2.1 — correção do publicador Cloudflare

Esta versão corrige o erro de sintaxe que acontecia em `PUBLICAR_BACKEND_3.2.0.bat` na etapa 3/5.

## Causa

O BAT montava um comando PowerShell `-Command` com redirecionamentos e pipes escapados para CMD (`^`). Esses caracteres chegavam ao parser do PowerShell e causavam `AmpersandNotAllowed` / `Token '^' inesperado` antes de o Wrangler executar o deploy.

## Correção

- `wrangler deploy` agora roda diretamente no CMD e grava `MARSHMALLOW_3.2.1_DEPLOY.log`.
- A validação HTTP foi movida para `scripts/validate-backend-3.2.1.ps1`, sem dupla camada de escaping.
- O endereço oficial permanece `https://marshmallow-gateway.marshmallow-browser-br.workers.dev`.
- Backend, app Electron e pacote foram marcados como 3.2.1.

## Como usar

1. Extraia esta versão por cima de `C:\MarshMallow-Electron`.
2. Execute `REPARAR_CONTAS_3.2.1.bat`.
3. Aguarde `[OK] Cadastro/login/recuperacao online ativos`.
4. O MarshMallow será iniciado automaticamente.

Não envie tokens, senhas ou segredos do Cloudflare pelo chat.
