# MarshMallow 3.1.9 — correção de cadastro/login

Esta versão corrige o erro genérico `Failed to fetch` na tela de criação de conta.

## O que mudou

- Cadastro, login, validação de sessão e logout agora passam por uma ponte nativa do Electron (`net.fetch`) em vez de depender do `fetch` cross-origin do renderer.
- A ponte aceita apenas as rotas oficiais de autenticação e `/health` do backend MarshMallow.
- O Worker agora envolve falhas do `AccountStore` e devolve JSON com diagnóstico em vez de deixar uma exceção virar um erro de rede genérico.
- Foi adicionado `/api/auth/ping`, que testa PBKDF2, Durable Object e armazenamento sem criar uma conta falsa.
- `/health` informa `backendVersion: 3.1.9` e `accountsConfigured`.
- O script `PUBLICAR_BACKEND_3.1.9.bat` só conclui se o Worker 3.1.9, Workers AI e AccountStore passarem nos testes.
- `REPARAR_CADASTRO_3.1.9.bat` executa a publicação/validação e inicia o navegador em seguida.
- Mantém o backend oficial `https://marshmallow-gateway.marshmallow-browser-br.workers.dev`.
- Mantém as melhorias anteriores: fonte de interface ampliada, menu de contexto, Watch Together, IA e ícone oficial.

## Para o proprietário

1. Extraia esta versão por cima de `C:\MarshMallow-Electron` ou em uma pasta limpa.
2. Execute `REPARAR_CADASTRO_3.1.9.bat`.
3. Aguarde o teste mostrar `AccountStore: ok / PBKDF2-SHA256`.
4. Quando o MarshMallow abrir, crie a conta normalmente.

## Para usuários finais

Depois que o proprietário publicar o backend e gerar o instalador, usuários finais não precisam de Cloudflare, Wrangler, API Token ou qualquer configuração de backend.
