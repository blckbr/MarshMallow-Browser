# MarshMallow 3.3.2 — páginas internas em abas

Nesta versão, **Favoritos e histórico**, **Temas** e **Configurações** deixam de abrir como painéis flutuantes sobre a página atual.

Ao clicar nos ícones `★`, `◈` e `⚙` da barra lateral, o MarshMallow cria uma nova aba interna:

- `marshmallow://library` — Favoritos e histórico
- `marshmallow://themes` — Temas e wallpaper
- `marshmallow://settings` — Central de Configurações

## Comportamento

As abas internas aparecem junto das demais abas do navegador. Elas podem ser ativadas, reorganizadas, fechadas com o `×` da aba ou com `Ctrl+W` e reabertas com `Ctrl+Shift+T`.

Em Favoritos e histórico há pesquisa, separação entre Favoritos/Histórico, remoção de favoritos e limpeza do histórico. Abrir um item cria uma aba web normal e mantém a biblioteca aberta.

Temas agora possui espaço próprio para os temas e controles de wallpaper. Configurações utiliza toda a área da aba em vez de cobrir o site aberto.

A barra de endereço mostra o endereço interno correspondente. Se o usuário digitar um endereço web enquanto estiver numa aba interna, essa aba é substituída por uma aba web normal.

## Compatibilidade

Esta atualização é somente do navegador desktop. Não é necessário republicar o backend Cloudflare.

A correção de fullscreen da 3.3.1, o backend de contas 3.2.3, o menu de contexto e o endereço `marshmallow-gateway.marshmallow-browser-br.workers.dev` permanecem preservados.
