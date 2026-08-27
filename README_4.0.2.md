# MarshMallow 4.0.2 — Login fica no navegador

Esta revisão corrige uma decisão equivocada do 4.0/4.0.1: páginas de autenticação não são mais redirecionadas automaticamente para Microsoft Edge, Google Chrome ou o navegador padrão do Windows.

## O que mudou

- Clicar em **Fazer login** no Google/YouTube/Gmail permanece na aba do MarshMallow.
- O mesmo vale para Microsoft, Apple e outros logins iniciados por páginas visitadas.
- Preferências antigas com `nativeAuthMode=auto` são neutralizadas automaticamente ao iniciar a 4.0.2.
- Abrir um site em navegador externo continua disponível apenas como ação manual em **Configurações > Compatibilidade** e no menu de contexto.
- Nenhuma senha, cookie ou token é copiado entre navegadores.

## Importante sobre o Google

Esta revisão corrige o comportamento sem lógica de abrir o Edge automaticamente. Ela não promete que o Google aceitará autenticação dentro do Electron/WebContentsView: essa decisão é do Google. O MarshMallow não tenta burlar CAPTCHA, proteção antiabuso ou política de navegadores incorporados.

## Teste recomendado

1. Execute `INICIAR_MARSHMALLOW_4.0.2.bat`.
2. Abra `https://www.google.com/`.
3. Clique em **Fazer login**.
4. Confirme que o fluxo permanece dentro do MarshMallow e que nenhum Edge/Chrome é aberto automaticamente.
