# MarshMallow 3.1.1 — Contas + IA gratuita corrigida

Esta revisão corrige os dois problemas reportados na 3.1.0.

## 1. IA online sem GEMINI_API_KEY obrigatória

O Worker agora possui um binding nativo do **Cloudflare Workers AI** e usa
`@cf/meta/llama-3.1-8b-instruct-fast` como provedor principal.

Isso significa que a mensagem:

`GEMINI_API_KEY não configurada no Worker`

não é mais o bloqueio normal da IA. Gemini passa a ser somente um fallback
opcional, configurável por `ATIVAR_GEMINI_FALLBACK_3.1.1.bat`.

Além disso, pedidos de previsão do tempo usam Open-Meteo diretamente. Portanto
um pedido como `previsão do tempo, Salvador` não depende de chave Gemini.

### Para ativar no Worker já existente

Execute uma única vez no computador do proprietário:

`PUBLICAR_BACKEND_3.1.1.bat`

O script:

1. confirma o login Cloudflare;
2. publica o Worker com o binding Workers AI;
3. adiciona o Durable Object de contas;
4. atualiza `.env.local` e `.env.production`;
5. valida `/health` e a rota de sessão.

## 2. Cadastro de novos usuários

No primeiro acesso, quando não existe sessão salva, o navegador agora abre uma
tela própria antes da interface principal.

Ela possui:

- **Criar conta** e **Entrar**;
- nome de exibição;
- nome de usuário único (`@usuario`);
- senha;
- confirmação de senha no cadastro.

As senhas não são salvas em texto puro. O backend usa PBKDF2-SHA256 com salt e
120.000 iterações, e a sessão usa um token aleatório com validade de 30 dias.

A conta é armazenada em um Durable Object `AccountStore` no mesmo backend
Cloudflare usado pelo MarshMallow. O nome de exibição da conta também vira o
nome inicial do Watch Together.

Em **Configurações** aparece o usuário conectado e um botão **Sair**.

### Correção específica da tela de cadastro no Electron

As páginas do navegador são `WebContentsView`, portanto ficam acima da interface
React. A 3.1.1 inicia o processo Electron em **modo shell-only**: todas as páginas
nativas ficam ocultas até a sessão de usuário ser validada. Assim, a tela
`Criar conta / Entrar` não pode ficar escondida atrás de uma aba restaurada.
Depois do login/cadastro, as abas são liberadas normalmente.

A tela de autenticação também recebeu os controles de minimizar, maximizar e
fechar, pois a janela do MarshMallow não usa a moldura padrão do Windows.

## 3. Ícone oficial

O ícone aprovado continua preservado em:

- `build/icon-source.png`
- `build/icon.png`
- `build/icon.ico`
- `public/icon.png` para a tela de cadastro

## Atualização recomendada

1. Extraia a pasta por cima do projeto anterior.
2. Execute `PUBLICAR_BACKEND_3.1.1.bat`.
3. Execute `INICIAR_MARSHMALLOW_ELECTRON.bat`.
4. Crie a primeira conta na tela inicial.
5. Teste a IA com `previsão do tempo, Salvador`.
6. Quando estiver satisfeito, execute `CRIAR_INSTALADOR_ELECTRON.bat`.

O instalador esperado é:

`release\MarshMallow-Setup-3.1.1.exe`
