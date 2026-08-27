# MarshMallow 4.0.4 — Omnibox inteligente + corretor ortográfico

Esta revisão adiciona duas camadas de produtividade inspiradas em navegadores modernos e teclados móveis.

## Barra de endereço inteligente

- Sugere páginas do histórico, favoritos e abas abertas enquanto o usuário digita.
- Ranking local por domínio/título, frequência de visitas, recência, favorito e aba já aberta.
- Exemplos aprendidos: depois de visitar Google/Gmail, `go` pode priorizar Google e `gm` pode priorizar Gmail.
- Atalhos de reconhecimento para serviços conhecidos (`go`, `gm`, `yt`, `ig`, `fb`, `gh`, `wa`, `rd`, `tw`) só são usados para priorizar candidatos que já estejam no histórico, favoritos ou abas.
- `↑` / `↓`: navegar entre sugestões.
- `Tab`: preencher a barra com a sugestão escolhida.
- `Enter`: abrir a sugestão escolhida.
- As sugestões são locais; nada é enviado ao mecanismo de busca até o usuário confirmar uma navegação/pesquisa.
- Em abas privadas, o histórico normal não entra no ranking.
- Histórico local ampliado de 200 para até 1000 endereços e passa a registrar contagem de visitas para melhorar o ranking.

A opção pode ser ligada/desligada em **Configurações → Pesquisa e preenchimento inteligente**.

## Corretor ortográfico melhorado

O MarshMallow usa o corretor nativo do Chromium/Electron. Quando uma palavra estiver marcada como incorreta, o clique com o botão direito agora mostra:

- até 6 sugestões de correção;
- substituição imediata pela sugestão escolhida;
- opção para adicionar a palavra ao dicionário;
- Recortar / Copiar / Colar / Selecionar tudo logo abaixo.

Funciona tanto em caixas de texto dos sites quanto nos campos editáveis da interface do MarshMallow (AI, Watch Together, configurações etc.). A barra de endereço continua sem correção ortográfica, como nos navegadores convencionais.

Idiomas continuam configuráveis em **Configurações → Idiomas**.

## Compatibilidade preservada

Esta revisão mantém o perfil `persist:marshmallow`, gerenciador/backup de cookies, Watch Together, MarshMallow AI, login/cadastro, fullscreen e demais recursos da 4.0.3.

Não é necessário republicar o backend para esta atualização.
