# MarshMallow Private Window Context — Design

## Objetivo

Adicionar navegação privada completa ao MarshMallow com:

- abas privadas dentro de uma janela normal;
- janelas privadas independentes;
- opção "Abrir link em nova aba privada";
- opção "Abrir link em nova janela privada";
- remoção de "Abrir no navegador nativo" do menu de contexto;
- nenhuma URL privada em histórico persistente;
- nenhuma aba privada em restauração de sessão;
- nenhuma aba privada recuperável por Ctrl+Shift+T.

## Comportamento do menu de contexto

Ao clicar com o botão direito sobre um link:

1. Abrir link em nova aba
2. Abrir link em nova aba privada
3. Abrir link em nova janela privada
4. Copiar endereço do link

A opção "Abrir no navegador nativo" não deve aparecer nesse fluxo.

A nova janela privada deve abrir diretamente em params.linkURL.

## BrowserContext

O processo principal deixará de depender de um único conjunto global de
tabs/activeTabId/closedTabs para todas as janelas.

Cada janela navegável será representada por um BrowserContext:

- window: BrowserWindow
- privateMode: boolean
- tabs: Map
- activeTabId
- closedTabs
- tabArea
- dockState
- htmlFullscreenTabId

O contexto da janela será resolvido a partir de event.sender nos handlers IPC.

Uma ação enviada pela janela privada nunca poderá alterar abas da janela normal.

## Janela normal

A janela principal continua usando o perfil persistente:

persist:marshmallow

Ela pode conter:

- abas normais;
- abas privadas explicitamente abertas pelo usuário.

## Janela privada

Uma janela privada:

- usa a mesma interface MarshMallow;
- nasce marcada como privateMode=true;
- inicia com o link solicitado ou marshmallow://newtab;
- Ctrl+T cria uma nova aba privada;
- links abertos em nova aba permanecem privados;
- não restaura sessão ao iniciar;
- não salva suas abas ao fechar;
- não adiciona suas abas a closedTabs.

Nenhuma aba normal poderá ser criada dentro de uma janela privada.

## Sessão privada compartilhada

Todas as abas privadas e todas as janelas privadas abertas simultaneamente
compartilham uma única sessão temporária Chromium.

Partition:

mm-private-session

Sem prefixo persist:.

Isso permite que um login realizado em um site privado continue disponível
em outra aba/janela privada enquanto a sessão privada estiver ativa.

Quando o último contexto privado for fechado:

- cookies privados são removidos;
- cache privado é removido;
- storage privado é removido;
- dados de sessão privados são apagados.

Uma futura navegação privada começa limpa.

## Histórico

O renderer continua proibido de persistir HistoryEntry quando active.private
for true.

A proteção passa a ser redundante:

1. UI não grava histórico privado.
2. BrowserContext privado não participa da restauração persistente.

## Abas fechadas

closeTab somente adiciona a aba em closedTabs quando:

tab.private === false

Consequências:

- Ctrl+Shift+T nunca reabre uma aba privada;
- Configurações > Reabrir aba fechada também não reabre conteúdo privado;
- URLs privadas não permanecem em memória por causa de closedTabs.

## IPC

Handlers que operam em abas deverão resolver seu BrowserContext através da
janela que originou a chamada.

Exemplo conceitual:

contextForWebContents(event.sender)

Em vez de acessar diretamente:

mainWindow
tabs
activeTabId
closedTabs

Isso vale para:

- new-tab
- new-private-tab
- close-tab
- reopen-tab
- navigate
- activate-tab
- set-layout
- ações de navegação
- histórico de navegação
- mute
- DevTools

## Criação de janela privada

Novo fluxo:

browser:new-private-window(url?)

O main process cria uma BrowserWindow MarshMallow normal visualmente, mas
associada a BrowserContext.privateMode=true.

A primeira aba recebe:

privateMode: true
url: url || marshmallow://newtab

## Atalhos

Na janela normal:

Ctrl+T
=> nova aba normal

Ctrl+Shift+N
=> nova janela privada

Na janela privada:

Ctrl+T
=> nova aba privada

Ctrl+Shift+N
=> nova janela privada adicional

Ctrl+Shift+T
=> somente abas não privadas daquele contexto; em contexto privado não há
histórico de abas fechadas privadas para restaurar.

## Identidade visual

Abas privadas continuam usando o M vermelho do MarshMallow em vez do favicon
do site.

Uma janela privada deve deixar visualmente claro que está em modo privado,
sem alterar o tema principal do navegador.

## Fullscreen e overlays

A refatoração por BrowserContext deve preservar:

- HTML fullscreen;
- toolbar overlay;
- balão Watch Together;
- dock;
- tabArea independente por janela.

Nenhum overlay de uma janela pode ser anexado a outra BrowserWindow.

## Downloads

Downloads iniciados em sessão privada podem funcionar normalmente, mas o
histórico persistente do MarshMallow não deve registrar a URL de origem da
sessão privada.

O arquivo explicitamente salvo pelo usuário não é apagado ao fechar o modo
privado.

## Segurança

A sessão privada não usa persist:.

Não herda extensões carregadas no perfil normal.

Ao terminar a última superfície privada, clearStorageData/cookies/cache será
executado explicitamente sobre a sessão temporária.

## Critérios de aceitação

1. Clique direito em link mostra "Abrir link em nova janela privada".
2. A opção "Abrir no navegador nativo" desaparece desse menu.
3. O link clicado abre numa BrowserWindow MarshMallow separada.
4. Ctrl+T dentro dela cria outra aba privada.
5. Abas privadas exibem o M vermelho.
6. Histórico normal não recebe páginas privadas.
7. Ctrl+Shift+T não recupera páginas privadas.
8. Fechar/reabrir o MarshMallow não restaura janelas ou abas privadas.
9. Login privado é compartilhado entre superfícies privadas simultâneas.
10. Depois de fechar a última superfície privada, uma nova sessão começa sem
cookies/login anteriores.
11. Uma ação numa janela privada nunca modifica a janela normal.
12. Fullscreen, toolbar overlay e Watch Together continuam isolados por janela.