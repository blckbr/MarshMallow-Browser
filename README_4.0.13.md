# MarshMallow 4.0.13 — Windows Wallpaper + AI Quick Tools

## Wallpaper

Na nova aba, quando houver um wallpaper ativo, agora existem ações para:

- baixar uma cópia em JPEG;
- aplicar diretamente como plano de fundo da área de trabalho do Windows;
- aplicar diretamente como imagem da tela de bloqueio do Windows.

O MarshMallow converte a imagem selecionada para JPEG antes de entregá-la ao Windows, inclusive para wallpapers WebP do MarshMallow Studio e fotografias online. Uma cópia usada pelo sistema é mantida na pasta de dados do navegador para que o Windows não perca a referência ao arquivo.

A alteração da tela de bloqueio usa a API de personalização do perfil do Windows. Políticas corporativas ou restrições da conta podem impedir essa operação; nesse caso o MarshMallow informa que o Windows recusou a mudança.

## MarshMallow AI — dois atalhos locais

O painel da IA ganhou dois botões que não dependem da IA online:

- **De qual aba vem o som?** — identifica todas as abas que estão realmente emitindo áudio e mostra título/site.
- **Diminuir consumo de RAM** — suspende as páginas em segundo plano, preserva a aba atual e mantém as abas visíveis. Ao clicar numa aba suspensa ela é recarregada automaticamente. Cookies e sessão persistente continuam no perfil.

A suspensão deliberadamente descarrega o conteúdo da página. Portanto, formulários não enviados ou estado exclusivamente em memória numa aba suspensa podem ser perdidos. O recurso não suspende a aba atual nem uma aba que esteja sendo usada pelo Watch Together.

## Mantido da 4.0.12

- restauração opcional das abas após reiniciar;
- wallpapers fotográficos, MarshMallow Studio, aleatório e imagem do dia;
- cookies persistentes e gerenciamento de cookies;
- omnibox inteligente, corretor ortográfico, mídia em segundo plano e demais recursos 4.x.

## Teste

1. Execute `VALIDAR_MARSHMALLOW_4.0.13.bat`.
2. Execute `TESTAR_WALLPAPER_WINDOWS_E_IA_4.0.13.bat`.
3. Só depois gere o instalador.
