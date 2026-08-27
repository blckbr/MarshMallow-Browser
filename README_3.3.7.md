# MarshMallow 3.3.7 — Menu de edição em caixas de texto

Esta revisão melhora o menu de contexto exibido ao clicar com o botão direito em campos de texto.

## Alterações

- Em `input`, `textarea` e outros campos editáveis de páginas web, o menu agora prioriza as ações de edição:
  - Recortar (`Ctrl+X`)
  - Copiar (`Ctrl+C`)
  - Colar (`Ctrl+V`)
  - Selecionar tudo (`Ctrl+A`)
- A correção também vale para caixas de texto da própria interface do MarshMallow, incluindo barra de endereço, MarshMallow AI e campos internos.
- Corrigido o caso em que havia texto selecionado dentro de uma caixa: antes o menu tratava a seleção como texto comum e escondia `Recortar`, `Colar` e `Selecionar tudo`.
- Fora de campos editáveis, o menu completo de página da versão 3.3.6 continua preservado.

Não é necessário republicar o backend Cloudflare para esta atualização.
