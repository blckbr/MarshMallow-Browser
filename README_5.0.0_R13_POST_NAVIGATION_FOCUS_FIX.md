# MarshMallow 5.0.0 R13 — Post-navigation focus fix

## Sintoma
Após usar Ctrl+L/omnibox para fazer uma busca no Google, um resultado podia não responder ao primeiro clique.

## Causa corrigida
O R12 chamava `webContents.focus()` imediatamente depois de `loadURL()`. Nesse ponto o WebContents ainda podia estar exibindo o documento anterior. Quando o novo documento era confirmado, o foco podia se perder e o primeiro clique servia apenas para ativar a nova página.

## Correção
- a navegação pela omnibox marca a aba com `focusAfterNavigation`;
- o foco não é mais aplicado ao documento antigo;
- `did-navigate` consome essa marca somente depois que o novo documento principal é confirmado;
- o caminho Google + disposition `default` usa o mesmo handoff pós-navegação;
- se `loadURL()` falhar, a marca é limpa para evitar roubo de foco posterior.

## Validação obrigatória no Windows
1. Abra o MarshMallow.
2. Pressione Ctrl+L.
3. Pesquise qualquer termo no Google.
4. Aguarde os resultados aparecerem.
5. Clique UMA vez em um resultado externo.
6. Repita em pelo menos três resultados.
7. Reprove a build se qualquer resultado exigir segundo clique/duplo clique.

Esta revisão não altera instalador, downloader, Watch Together, docks ou políticas de segurança de páginas.
