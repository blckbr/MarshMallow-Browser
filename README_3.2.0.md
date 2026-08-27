# MarshMallow 3.2.0 — contas locais + recuperação

Esta versão corrige o fluxo de contas Cloudflare e adiciona recuperação de senha para contas locais.

## O que mudou

- O AccountStore agora usa um registro novo (`registry-v3-2`), isolando qualquer instância antiga que tenha ficado em estado ruim.
- Toda a lógica do Durable Object possui uma barreira de exceção; falhas passam a voltar como JSON legível em vez da página genérica `Worker threw an unhandled exception`.
- `/api/auth/ping` faz autoteste de PBKDF2, código de recuperação e armazenamento antes de considerar o backend válido.
- Contas locais recebem um **código de recuperação único** após cadastro. O servidor guarda apenas um hash/verificador desse código.
- A tela **Esqueci minha senha** redefine a senha usando `@usuario + código de recuperação + nova senha`.
- Depois de uma recuperação bem-sucedida, todas as sessões antigas são invalidadas e um **novo código de recuperação** é emitido; o antigo deixa de funcionar.
- O código completo é mostrado somente após cadastro ou recuperação. Guarde-o fora do computador.
- O backend oficial permanece `https://marshmallow-gateway.marshmallow-browser-br.workers.dev`.

## Para atualizar o backend

1. Extraia esta versão por cima de `C:\MarshMallow-Electron`.
2. Execute `REPARAR_CONTAS_3.2.0.bat`.
3. O script publica e valida o backend e inicia o navegador.
4. Crie a conta. Antes de entrar no navegador, o MarshMallow exibirá o código de recuperação.

## Google e Microsoft

Quando login Google/Microsoft for integrado, a recuperação dessas contas continuará sendo feita pelo próprio provedor. O código de recuperação do MarshMallow é para contas locais.
