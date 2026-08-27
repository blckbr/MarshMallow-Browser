# MarshMallow 3.2.2 — AccountStore Durable Object Hotfix

Esta revisão corrige o erro HTTP 500 que aparecia logo após o `/health` durante a validação de contas.

## Correções
- `AccountStore` não sobrescreve mais manualmente `this.ctx` e `this.env`; a classe base `DurableObject` da Cloudflare fornece essas propriedades.
- O registro de contas de teste passa a usar a instância limpa `registry-v3-2-2`.
- A chamada usa `env.ACCOUNTS.getByName(...)`, conforme a API atual de Durable Objects.
- Erros propagados pelo Durable Object agora incluem indicadores `remote`, `retryable` e `overloaded`.
- O validador 3.2.2 tenta mostrar o corpo JSON real de qualquer erro HTTP.

## Como aplicar
Execute `REPARAR_CONTAS_3.2.2.bat`.
