# MarshMallow 3.1.5 — workers.dev migration fix

Esta versao corrige o diagnostico do erro Cloudflare `10036 Account already has an associated subdomain`.

## O que estava errado

`PUT /accounts/{account_id}/workers/subdomain` e documentado pela Cloudflare como **Create Subdomain**. Quando a conta ja possui um `workers.dev`, a API pode responder `10036` para qualquer nome, porque o problema nao e disponibilidade do nome: a conta ja tem um subdominio associado.

## Fluxo corrigido

`ALTERAR_LINK_PARA_MARSHMALLOW.bat` agora:

1. detecta e guarda o subdominio atual;
2. pede duas confirmacoes antes de qualquer exclusao;
3. remove o subdominio atual da conta;
4. aguarda a propagacao da exclusao;
5. cria o novo nome;
6. se a criacao falhar, tenta restaurar automaticamente o nome anterior;
7. republica `marshmallow-gateway`;
8. garante `workers.dev` habilitado para o Worker;
9. valida `/health`;
10. cria um convite real e atualiza `.env.local`, `.env.production` e `.watch_backend_url`.

Durante a troca, enderecos `*.workers.dev` dessa conta podem ficar indisponiveis por alguns segundos.

## Importante

Use somente o nome antes de `.workers.dev`, por exemplo:

`marshmallow-browser-br`

Nunca digite `marshmallow-browser-br.workers.dev` no campo.
