# MarshMallow 4.0.3 — Login + Cookies Persistentes

Esta revisão corrige duas áreas importantes antes do instalador definitivo.

## Login Google / YouTube

- O perfil normal continua usando `persist:marshmallow`, portanto cookies e armazenamento dos sites permanecem entre reinicializações.
- As permissões Chromium `storage-access` e `top-level-storage-access` agora são tratadas explicitamente. Antes, o manipulador genérico do MarshMallow bloqueava permissões desconhecidas e isso podia interromper fluxos modernos de autenticação que dependem da Storage Access API.
- Popups de autenticação Google iniciados por Google/YouTube passam a permanecer na aba atual, evitando perder o contexto do fluxo ao transformar o popup em uma aba independente.
- Google/YouTube usam uma identificação de runtime coerente durante o fluxo.

## Cookies e dados

Em Configurações → Cookies e dados:

- listar/pesquisar cookies por domínio e nome;
- apagar um cookie individual;
- apagar todos os cookies;
- forçar `flushStore()` / gravação imediata no disco;
- ver o caminho do perfil persistente;
- exportar um backup `.mmcookies`;
- importar o backup depois.

O backup não é JSON em texto puro: os valores dos cookies são criptografados com AES-256-GCM, usando chave derivada da senha informada pelo usuário via PBKDF2-SHA256. A senha não é salva pelo MarshMallow.

## Importante

Cookies de autenticação podem equivaler a uma sessão já autenticada. O arquivo `.mmcookies` e sua senha devem ser tratados como dados sensíveis.

Abas privadas continuam usando partições temporárias em memória e não entram no gerenciador/backup do perfil normal.

## Teste recomendado

1. Execute `INICIAR_MARSHMALLOW_4.0.3.bat`.
2. Abra YouTube e clique em Fazer login.
3. Conclua o fluxo e confirme se a conta permanece conectada após fechar e abrir o MarshMallow.
4. Abra Configurações → Cookies e dados e pesquise `youtube` e `google`.
5. Clique em Salvar cookies agora.
6. Feche/reabra e confirme a persistência.

Não gere o instalador definitivo antes desse teste.
