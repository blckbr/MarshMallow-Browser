# MarshMallow 3.1.4 — Cloudflare subdomain retry fix

Esta atualização corrige o assistente `ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1`.

- a mensagem de erro agora mostra o nome realmente solicitado;
- um HTTP 409 não encerra mais o assistente;
- é possível tentar outro subdomínio na mesma execução, sem recriar o API Token;
- o padrão agora é `marshmallow-browser`;
- o script reforça que deve ser digitado somente o rótulo, sem `.workers.dev`;
- tenta mostrar a mensagem JSON real devolvida pela API da Cloudflare quando disponível.

Execute `ALTERAR_LINK_PARA_MARSHMALLOW.bat`.
