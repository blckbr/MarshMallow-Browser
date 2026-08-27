# MarshMallow 3.3.1 — Fullscreen HTML real

Esta revisão corrige o modo de tela cheia de vídeos e players HTML5 quando as páginas são hospedadas em `WebContentsView`.

## Correção principal

Antes, ao chamar `requestFullscreen()`, a janela podia entrar em fullscreen mas o `WebContentsView` continuava usando a área normal reservada abaixo da barra de navegação e ao lado da barra de abas. Isso causava dois sintomas:

- o vídeo não ocupava a tela inteira;
- a barra de endereço/pesquisa podia ficar cobrindo a parte superior do vídeo.

A 3.3.1 escuta `enter-html-full-screen` / `leave-html-full-screen` no `webContents` de cada aba. Durante o fullscreen:

- a aba ativa passa a usar `x=0`, `y=0` e todo o `contentBounds` da janela;
- outras abas nativas ficam ocultas;
- o balão flutuante do chat também é ocultado;
- os bounds são recalculados durante a transição/resize para evitar bordas ou um frame residual da toolbar.

Ao sair com Esc ou com o próprio botão do player, o layout normal é restaurado automaticamente.

## Backend

Nenhuma mudança de backend é necessária para esta correção.
