# MarshMallow 3.1.3 — workers.dev Brand API Fix

Esta revisão corrige o assistente de mudança do link de convite para a interface atual da Cloudflare.

## Objetivo

Trocar o subdomínio de conta usado em:

`https://marshmallow-gateway.marshmallow-browser-br.workers.dev`

para, se o nome estiver disponível:

`https://marshmallow-gateway.marshmallow.workers.dev`

Os convites passam automaticamente a usar a nova origem:

`https://marshmallow-gateway.marshmallow.workers.dev/join/CODIGO`

## Como fazer

Execute:

`ALTERAR_LINK_PARA_MARSHMALLOW.bat`

O assistente agora usa a API oficial da Cloudflare `PUT /accounts/{account_id}/workers/subdomain` em vez de depender do bloco "Your subdomain" do Dashboard.

O script:

1. confere o login do Wrangler;
2. detecta o Account ID;
3. abre a página de API Tokens da Cloudflare;
4. pede um token temporário com `Workers Scripts: Edit`;
5. solicita `marshmallow` como subdomínio da conta;
6. republica `marshmallow-gateway`;
7. atualiza `.watch_backend_url`, `.env.local` e `.env.production`;
8. cria um convite real e valida o novo endereço.

O token é digitado de forma oculta e não é salvo em arquivo.

## Importante

O subdomínio `workers.dev` pertence à conta Cloudflare inteira. Alterá-lo muda o endereço `workers.dev` de todos os Workers da mesma conta.

O nome `marshmallow` precisa estar disponível globalmente no `workers.dev`. Caso a Cloudflare informe que já está em uso, o assistente mostrará o erro e será necessário escolher uma variante da marca.
