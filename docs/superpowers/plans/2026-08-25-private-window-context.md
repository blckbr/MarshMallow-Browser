# MarshMallow Private Window Context Implementation Plan

**Goal:** Isolar completamente a navegação privada por `BrowserContext`.

**Spec:** `docs/superpowers/specs/2026-08-25-private-window-context-design.md`

## Concluído

- [x] Task 1: abas privadas fora de `closedTabs`
- [x] Task 2: `BrowserContext`
- [x] Task 3: ciclo de vida de abas por contexto
- [x] Task 4: IPC básico por contexto
- [x] Task 5: sessão temporária compartilhada `mm-private-session`
- [x] Task 6: janela privada completa
- [x] Task 7: menu de contexto, Ctrl+Shift+N, window controls, estado de abas, toolbar `(...)` e dock inicial

## Task 8 — Isolamento restante por janela

### 8A — IPCs operacionais
- [x] `browser:action` por `event.sender`
- [x] histórico de navegação por contexto
- [x] `go-navigation-index` por contexto
- [x] mute por contexto
- [x] DevTools/inspect por contexto
- [x] shell-only por contexto
- [x] foco da barra de endereço no shell correto
- [x] reorder/extract-text por contexto
- [x] abas audíveis/suspensão por contexto
- [x] Modo Jogo e diagnóstico da aba ativa por contexto
- [x] scanner/downloader de mídia usa a aba do contexto solicitante
- [x] autenticação nativa e avisos de popup retornam ao shell solicitante

### 8B — Fullscreen e layout
- [x] `applyTabArea` por `BrowserContext`
- [x] `htmlFullscreenTabId` por contexto
- [x] bounds usando `context.window`
- [x] resize/move/fullscreen isolados
- [x] fechamento de uma janela não paralisa outro `BrowserContext` sobrevivente

### 8C — Overlays e UI nativa
- [x] toolbar `(...)` por contexto
- [x] chat bubble por contexto
- [x] nenhum overlay anexado à `BrowserWindow` errada
- [x] menu de edição do shell por contexto
- [x] permissões de site ancoradas na janela solicitante
- [x] diálogos e ferramentas do menu de página ancorados no contexto solicitante
- [x] maximize/unmaximize da janela privada retorna ao shell correto

### 8D — Watch Together
- [x] abertura inicial do dock por contexto
- [x] publisher usa aba ativa do contexto correto
- [x] status retorna ao shell correto
- [x] chat bubble abre/fecha no contexto correto
- [x] stop-media não afeta outra janela
- [x] captura não cruza contextos
- [x] fechamento de janela privada encerra somente seu publisher

## Task 9 — Verificação final de privacidade

### Cobertura automatizada concluída
- [x] partições normal e privada são diferentes (`persist:marshmallow` / `mm-private-session`)
- [x] sessão privada é compartilhada enquanto houver superfície privada
- [x] última superfície privada dispara limpeza de storage/cache/conexões
- [x] histórico privado não persiste
- [x] session restore não inclui privados
- [x] `Ctrl+Shift+T` não restaura privados
- [x] downloads privados não persistem URL no histórico de downloads
- [x] fullscreen/toolbar/chat bubble/Watch Together/dock isolados estruturalmente
- [x] rotas de estado, navegação, menu de contexto, IA, downloads UI, mídia e Modo Jogo não usam a aba ativa global
- [x] suíte Node completa com 0 falhas

### Smoke obrigatório no Windows antes de publicar
- [ ] confirmar cookie privado compartilhado entre duas superfícies privadas simultâneas
- [ ] confirmar cookie normal invisível na sessão privada e vice-versa
- [ ] fechar a última superfície privada, reabrir e confirmar que o cookie privado desapareceu
- [ ] confirmar fullscreen normal e privado lado a lado
- [ ] confirmar toolbar/chat bubble/Watch Together lado a lado
- [ ] iniciar download privado, fechar/reabrir e confirmar que o arquivo permanece no disco sem URL privada restaurada no histórico
- [ ] fechar a janela normal mantendo uma privada aberta e confirmar que a privada continua operacional

> Observação: os itens de smoke acima dependem do runtime Electron/Windows real e não podem ser validados apenas pelos testes estruturais Node executados no sandbox.
