# MarshMallow 5.0.0 R11 — Google Result Navigation Fix

## Sintoma corrigido

Em uma pagina de resultados do Google, clicar em determinados resultados podia manter o usuario na propria busca, com aparencia de recarregamento, em vez de abrir o destino.

## Causa

O MarshMallow usa `webContents.setWindowOpenHandler()` para impedir que conteudo remoto crie BrowserWindows soltas. O Chromium pode classificar alguns fluxos de abertura de resultado do Google com disposition `default`. A politica Smart tratava apenas `foreground-tab`, `background-tab` e `new-window` como gestos de aba permitidos; uma abertura `default` cross-origin era negada.

Como o handler sempre retorna `action: deny` depois de decidir se recria ou nao a navegacao dentro do sistema de abas MarshMallow, esse caso podia ser cancelado sem destino visivel.

## Correcao

- paginas `google.com/search` e `google.com.br/search` passam a aceitar especificamente uma abertura HTTP/HTTPS com disposition Chromium `default`;
- a protecao Smart continua bloqueando `default` cross-origin em paginas comuns;
- as regras mais restritas dos sites de anime continuam inalteradas;
- middle-click/Ctrl+click continuam usando aba de segundo plano;
- foi adicionado teste automatizado para Google e teste negativo para popup automatico comum;
- o smoke test Windows agora exige busca no Google e clique em pelo menos tres resultados externos.

## Validacao recomendada no Windows

1. Compile o pacote normalmente.
2. Abra `https://www.google.com/`.
3. Pesquise um termo comum.
4. Clique com o botao esquerdo em pelo menos tres resultados de sites diferentes.
5. Todos devem abrir/navegar normalmente; nenhum clique pode apenas manter/recarregar a pagina de resultados.
6. Teste tambem middle-click em um resultado: deve abrir em segundo plano.
7. Confirme que popups automaticos cross-site de paginas comuns continuam bloqueados no modo Smart.
