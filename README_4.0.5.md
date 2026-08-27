# MarshMallow 4.0.5 — Nova aba limpa + wallpaper

Esta revisão transforma a página inicial/nova aba padrão do MarshMallow em uma página interna limpa (`marshmallow://newtab`), em vez de abrir o Google automaticamente.

## Comportamento

- Nova aba padrão: fundo limpo do MarshMallow.
- Página inicial padrão: a mesma nova aba interna.
- A barra de endereço fica vazia ao abrir a nova aba e continua aceitando o omnibox inteligente do 4.0.4.
- Se o usuário já escolheu um wallpaper, ele ocupa a área da nova aba.
- Se ainda não escolheu wallpaper, aparece um convite discreto no canto inferior para personalizar o navegador.
- O convite permite escolher uma imagem imediatamente ou abrir a aba Temas.
- Ao escolher a imagem, a dica desaparece e o wallpaper aparece na própria nova aba.
- Abas privadas usam a mesma página interna, mas mostram apenas um indicador discreto de modo privado; não exibem o convite de personalização.

## Migração

Instalações antigas que ainda usam exatamente `https://www.google.com/` como página inicial/nova guia padrão são migradas automaticamente para `marshmallow://newtab`.

Se o usuário tiver configurado outro endereço personalizado, ele é preservado.

## Teste

1. Execute `VALIDAR_MARSHMALLOW_4.0.5.bat`.
2. Execute `INICIAR_MARSHMALLOW_4.0.5.bat`.
3. Abra uma nova aba (`Ctrl+T` ou `+`).
4. Confirme que o conteúdo não abre Google nem outro site.
5. Sem wallpaper, use o convite no canto inferior para escolher uma imagem.
6. Abra outra nova aba e confirme que o wallpaper é exibido.
7. Digite `go` ou `gm` na barra e confirme que as sugestões inteligentes continuam disponíveis.

Não é necessário republicar o backend para esta versão.
