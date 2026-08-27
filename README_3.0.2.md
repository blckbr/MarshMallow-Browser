# MarshMallow 3.0.2 — Watch/AI Panel Layer Fix

Correção do caso em que clicar em Watch Together parecia não fazer nada.

## Causa

As páginas das abas são `WebContentsView`, que são superfícies nativas do
Electron. Elas ficam acima do renderer React. O painel Watch Together estava
abrindo, mas era desenhado atrás da página.

## Correção

Ao abrir Watch Together ou MarshMallow AI:

- o `WebContentsView` da aba é redimensionado;
- 386 px reais são reservados no lado direito;
- o painel é desenhado nessa área, fora da superfície nativa da página;
- `ResizeObserver` já existente envia os novos bounds ao processo principal;
- ao fechar o painel, a página volta automaticamente à largura total.

Watch e AI também passam a ser mutuamente exclusivos para não se sobreporem.
