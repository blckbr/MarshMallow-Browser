# MarshMallow 5.0.0

MarshMallow 5.0.0 é a atualização de estabilidade, compatibilidade e experiência de uso do navegador Windows com interface Black Piano.

## Principais mudanças verificadas na fonte

- Toolbar reorganizada em uma única linha responsiva, eliminando os controles escondidos da linha 4.1.0.
- Histórico de navegação estilo Brave: clique normal volta/avança uma entrada; segurar ou clicar com o botão direito abre a lista real do histórico Chromium.
- Omnibox/autocomplete com handshake de prontidão e replay de estado para impedir o painel vazio na primeira abertura.
- Game Mode por domínio para jogos modernos HTML5/WebGL/WebAssembly, com modos Automático / Sempre ligado / Desligado e economia de recursos em segundo plano por site.
- Página interna de diagnóstico de desempenho com informações factuais de GPU/WebGL/WebGL2/Canvas/Gamepad.
- Correção da geometria nativa de WebContentsView para que painéis de Mídia, IA e Watch Together não sejam cortados ou cobertos pela página.
- Detector de mídia baseado em Content-Type, URL e observações da página, com HLS/DASH, MediaSource, áudio/vídeo separados e agrupamento de tráfego adaptativo.
- União local de vídeo + áudio quando fluxos compatíveis forem detectados e FFmpeg estiver disponível.
- Gerenciador de downloads integrado normal com progresso, pausa, retomada, cancelamento, histórico, abrir arquivo/pasta e Ctrl+J.
- Integração opcional reservada para o futuro MarshMallow Downloader Manager. O navegador continua independente e usa o gerenciador integrado por padrão.
- Página de apoio voluntário e discreto para APOIA.se, Ko-fi e Buy Me a Coffee, sem popups de cobrança.
- Atualizações validadas contra o repositório oficial e instalador verificado por SHA-256 antes de ser tratado como válido.
- Proteções de DRM mantidas; o navegador não descriptografa nem contorna conteúdo protegido.

## Gerenciador de downloads

O MarshMallow 5.0.0 funciona sozinho. O gerenciador integrado é o padrão inclusive quando o MarshMallow Downloader Manager não está instalado.

O navegador consulta o manifesto oficial `https://marshmallow-browser-br.pages.dev/download/manager.json`. Enquanto o aplicativo independente não possuir instalador oficial, o manifesto permanece com `available=false` e nenhum link morto é apresentado ao usuário.

Quando o MarshMallow Downloader Manager for lançado, a integração poderá ser escolhida em Configurações > Downloads. Downloads privados permanecem no gerenciador integrado.

## Publicação

A publicação de `v5.0.0` é fail-closed: `download/release.json` permanece indisponível até o instalador Windows passar pela compilação real, validação SHA-256 e smoke test de runtime. O fluxo oficial de Windows está em:

- `VALIDAR_E_COMPILAR_MARSHMALLOW_5.0.0.bat`
- `REGISTRAR_SMOKE_5.0.0.bat`
- `PUBLICAR_MARSHMALLOW_5.0.0.bat`
- `DIAGNOSTICAR_MARSHMALLOW_5.0.0.bat`

Criado e desenvolvido por **Deivison Santos / @devsaex**.
