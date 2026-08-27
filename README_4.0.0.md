# MarshMallow 4.0.0 — Native Compatibility Core

## O que mudou

O MarshMallow 4.0 inicia a migração para uma arquitetura em que fluxos de autenticação protegidos não dependem do navegador incorporado.

O Google documenta que pode recusar logins em navegadores incorporados e cita explicitamente CEF/WebView como um caso que deve migrar para autenticação em navegador. Por isso esta versão não tenta mascarar o User-Agent, automatizar o Google ou contornar CAPTCHA.

Quando um fluxo protegido tenta abrir `accounts.google.com` (e endpoints equivalentes de Microsoft/Apple), o MarshMallow 4.0 abre a autenticação diretamente em um navegador de desktop real, preferindo Microsoft Edge e usando Chrome ou o navegador padrão como alternativas.

## O que permanece no MarshMallow

- interface Black Piano;
- abas verticais e modo compacto;
- Favoritos e Histórico em aba interna;
- Temas e Configurações em abas internas;
- MarshMallow AI;
- Watch Together e chat;
- menu de contexto completo;
- tela cheia de vídeo;
- contas locais e recuperação;
- backend Cloudflare atual;
- endereço oficial `marshmallow-gateway.marshmallow-browser-br.workers.dev`;
- autoria oficial: Deivison Santos / @devsaex.

## Compatibilidade de login

Em **Configurações → Compatibilidade** há:

- Logins protegidos: automático ou desativado;
- Navegador nativo preferido: Edge, Chrome ou padrão do Windows;
- botão de teste do Google;
- botão para abrir o Google no modo nativo.

Também existe **Abrir no navegador nativo** no menu de botão direito de páginas web.

## Limitação importante desta primeira versão 4.0

A página aberta no navegador nativo usa a sessão/cookies desse navegador. Ela não compartilha automaticamente cookies com o renderer incorporado do MarshMallow. Isso é intencional: copiar cookies de Chrome/Edge seria inseguro e poderia quebrar o modelo de segurança dos navegadores.

Portanto, sites que exigirem Google Sign-In e recusarem o renderer incorporado devem continuar no modo nativo depois da autenticação.

## Por que não CEF/WebView2?

Trocar Electron por outro WebView não resolveria a causa. O Google também trata CEF como navegador incorporado. O objetivo da linha 4.x é eliminar gradualmente dependências desse tipo em fluxos que exigem um navegador de desktop reconhecido.

## Teste recomendado

1. Execute `INICIAR_MARSHMALLOW_4.0.bat`.
2. Entre em **Configurações → Compatibilidade**.
3. Clique em **Testar login Google no modo nativo**.
4. Faça login no Edge/Chrome aberto.
5. No MarshMallow, abra uma página que ofereça Google Sign-In e confirme que `accounts.google.com` é encaminhado para o navegador nativo.

## Instalação

Para gerar o NSIS do Windows:

`CRIAR_INSTALADOR_4.0.bat`

Saída esperada:

`release\MarshMallow-Setup-4.0.0.exe`
