# MarshMallow 3.1.2 — Branded Invite URL

Esta revisão remove do projeto o fallback que continha um identificador pessoal no endereço Cloudflare.

## Link desejado

Se o subdomínio de conta `marshmallow` estiver disponível no Cloudflare, o Worker existente ficará em:

`https://marshmallow-gateway.marshmallow.workers.dev`

Os convites são gerados a partir da origem real do Worker, portanto assumem automaticamente o formato:

`https://marshmallow-gateway.marshmallow.workers.dev/join/CODIGO`

## Fazer a alteração

Execute `ALTERAR_LINK_PARA_MARSHMALLOW.bat`.

O script abre o painel Cloudflare para a única etapa que precisa ser feita na conta: alterar **Your subdomain**. Em seguida ele republica o mesmo Worker, detecta a nova URL, atualiza `.env.local` e `.env.production` e cria uma sala para verificar que o link não contém mais o identificador antigo.

O subdomínio `workers.dev` é definido no nível da conta Cloudflare, portanto a mudança afeta as URLs `workers.dev` de todos os Workers dessa conta.

O DNS usa letras minúsculas, então `marshmallow` aparecerá assim mesmo que a marca seja escrita `MarshMallow` na interface.
