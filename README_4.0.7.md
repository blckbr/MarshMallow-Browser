# MarshMallow 4.0.7 — Native Omnibox Overlay

Correção do painel de sugestões da barra de endereço que podia ficar oculto atrás do conteúdo de páginas (especialmente vídeos do YouTube).

## Mudança principal

O autocomplete não é mais renderizado como um `div` do shell React. Páginas abertas usam `WebContentsView`, que fica em uma camada nativa acima do renderer do shell; portanto `z-index` não resolvia o problema.

A 4.0.7 usa um `WebContentsView` transparente dedicado para o dropdown da omnibox, reordenado acima da aba ativa. A página não é mais empurrada para baixo quando as sugestões aparecem.

## Resultado esperado

1. Abra YouTube ou qualquer site.
2. Clique na barra e digite parte de um endereço já visitado, por exemplo `go` ou `gm`.
3. O painel deve flutuar sobre a página, visível acima de vídeo, imagens e demais conteúdos.
4. `Esc` fecha o painel e restaura a URL real da aba.
5. Se não houver sugestões, nada é exibido.
