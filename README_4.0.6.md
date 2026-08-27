# MarshMallow 4.0.6 — Esc restaura a URL da aba

Esta revisão adiciona à barra de endereço o comportamento tradicional encontrado em navegadores de desktop.

## Comportamento

- Se o usuário apagar o endereço atual e pressionar `Esc`, o endereço real da página volta para a barra.
- Se o usuário substituir o endereço por outro texto/URL, mas ainda não navegar, `Esc` cancela a edição e restaura a URL da aba.
- Se uma sugestão do omnibox tiver sido preenchida com `Tab`, `Esc` também restaura a URL atual.
- Em `marshmallow://newtab`, cujo endereço visual é vazio, `Esc` restaura a barra vazia.
- As sugestões são fechadas e o foco sai da barra após a restauração.
- `Enter`, `Tab`, setas e o autopreenchimento inteligente do 4.0.4 continuam inalterados.

## Teste

1. Execute `VALIDAR_MARSHMALLOW_4.0.6.bat`.
2. Execute `INICIAR_MARSHMALLOW_4.0.6.bat`.
3. Abra qualquer página, por exemplo `https://example.com/`.
4. Clique na barra e apague completamente a URL.
5. Pressione `Esc`: `https://example.com/` deve voltar.
6. Digite outro endereço sem pressionar Enter e pressione `Esc`: a URL atual deve voltar novamente.
7. Abra uma nova aba: digite algo e pressione `Esc`; a barra deve voltar a ficar vazia.

Não é necessário republicar o backend.
