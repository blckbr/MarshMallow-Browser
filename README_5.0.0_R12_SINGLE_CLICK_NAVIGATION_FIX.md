# MarshMallow 5.0.0 R12 — Single-click navigation / focus handoff

## Sintoma corrigido
Após uma busca no Google, um resultado podia exigir duplo clique: o primeiro clique apenas transferia foco e o segundo acionava o link.

## Causa
O chrome React (barra de endereço) e a página são WebContents diferentes no Electron. Ao navegar pela omnibox, o input do shell mantinha o foco enquanto `loadURL()` carregava a página. O processo principal não devolvia explicitamente o foco ao WebContentsView ativo.

Além disso, o R11 tratava `WindowOpenDisposition = default` do Google criando uma nova aba sintética. O Electron define `default` como um caso em que a navegação dentro da janela é válida.

## Correção R12
- `navigateTo()` desfoca explicitamente a omnibox antes da navegação;
- `browser:navigate` devolve foco ao WebContentsView ativo imediatamente após iniciar `loadURL()`;
- Google Search com disposition `default` navega no WebContents atual e preserva foco, em vez de criar uma aba sintética;
- middle-click / Ctrl+click continuam usando abas;
- proteção Smart de pop-ups e regras rígidas para sites de anime permanecem;
- smoke test exige clique único em três resultados externos do Google.

## Validação obrigatória no Windows
1. Abra o MarshMallow.
2. Use Ctrl+L ou clique na omnibox.
3. Pesquise qualquer termo no Google.
4. Clique UMA VEZ em um resultado externo.
5. Repita em três resultados diferentes.
6. Reprove a build se qualquer resultado exigir duplo clique.
