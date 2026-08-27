# MarshMallow 5.0.0 — Windows Test Kit R9

## Revisão de camadas React × WebContentsView

Base revisada: `MarshMallow_5.0.0_WINDOWS_TEST_KIT_R8.zip`.

### Causa encontrada

O menu `⋯` da toolbar era renderizado pelo React como um popover absoluto. Como as páginas externas usam `WebContentsView`, a parte do menu que avançava para baixo da toolbar podia ficar fisicamente atrás da página, independentemente do `z-index`.

O mesmo risco existia no `browser-toast`, que era um elemento React `position: fixed` no rodapé central da janela e podia ser coberto pelo `WebContentsView` de uma página externa.

### Correções R9

1. O menu `⋯` agora participa de `chromePopoverHeight` e reserva 218 px reais abaixo da toolbar enquanto está aberto.
2. O `ResizeObserver` já existente transmite a nova geometria ao processo principal, fazendo o `WebContentsView` recuar de verdade.
3. Ao fechar o menu, a página retorna automaticamente à posição normal.
4. Menu `⋯` e histórico Voltar/Avançar passam a ser mutuamente exclusivos para não sobrepor dois popovers de chrome.
5. O toast foi movido para dentro da faixa superior do chrome do navegador, fora da área ocupada pela página nativa.
6. O smoke test do Windows ganhou verificações específicas para o menu `⋯` e para mensagens temporárias/toasts.

## Auditoria dos demais elementos de interface

- Autocomplete: protegido por reserva vertical real (`chromePopoverHeight`).
- Histórico de Voltar/Avançar: protegido por reserva vertical real.
- IA: dock lateral com largura nativa reservada.
- Watch Together: dock lateral com largura nativa reservada.
- Downloads/Mídia: dock lateral com largura nativa reservada.
- Modo Jogo: dock lateral com largura nativa reservada.
- Organizador: dock lateral com largura nativa reservada.
- Configurações: aba interna; ao ativá-la, nenhuma página externa permanece visível por cima.
- Favoritos/Histórico, Temas, Extensões, Suporte e Desempenho: abas internas, sem `WebContentsView` de site sobre a interface.
- Cadastro/Login: `shellOnly` oculta as páginas nativas durante a autenticação.
- Balão do Watch Together: tratado no processo principal como superfície própria, não como overlay React sobre a página.

Nesta revisão estática, não restou outro elemento React ativo que dependa apenas de `z-index` para aparecer sobre uma página externa.

## Validação recomendada no Windows

1. Abra uma página externa comum (YouTube, Google ou outro site).
2. Clique em `⋯`.
3. Confirme que todos os itens do menu aparecem por inteiro, inclusive **Configurações**, e são clicáveis.
4. Confirme que a página recua para baixo enquanto o menu está aberto e volta ao normal ao fechar.
5. Clique em **Configurações** e confirme que a Central abre totalmente visível na aba interna.
6. Teste autocomplete da omnibox e histórico de Voltar/Avançar para confirmar que continuam visíveis.
7. Abra IA, Watch Together, Downloads, Modo Jogo e Organizador e confirme que cada dock redimensiona a página lateralmente.
8. Execute uma ação que gere uma mensagem temporária/toast e confirme que ela aparece na faixa superior, sem ficar atrás do site.
9. Execute `VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.0.bat`.
10. Depois do instalador ser gerado, execute `REGISTRAR_SMOKE_5.0.0.bat` e responda `S` somente aos itens realmente aprovados.

## Arquivos alterados

- `src/App.tsx`
- `src/styles.css`
- `tests/chrome-navigation-ui.test.mjs`
- `scripts/windows-smoke-5.0.ps1`

## Autoria

Criador e desenvolvedor do MarshMallow: **Deivison Santos / @devsaex**.
