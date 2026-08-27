# MarshMallow 3.1.0 — Complete Electron Integration

Esta versão continua diretamente a base 3.0.7 e recupera, no núcleo Electron/WebContentsView, os recursos de navegador que tinham ficado de fora durante a migração.

## O que está integrado

### Navegação e abas
- abas reais com `WebContentsView`;
- abas verticais normais e compactas;
- favicon preservado no modo compacto;
- `×` aparece somente na aba ativa, em hover ou foco no modo compacto;
- arrastar e soltar para reordenar abas;
- histórico de abas fechadas e reabertura;
- restauração de sessão;
- título, favicon, áudio e mute por aba;
- popup guard e proteção de redirecionamento já existentes na 3.0.6/3.0.7.

### Abas privadas
- botão `◐` para abrir aba privada;
- `Ctrl+Shift+N` abre uma aba privada;
- `Ctrl+T` dentro de uma aba privada continua em sessão privada;
- links/popup abertos a partir de uma aba privada continuam privados;
- partição Electron em memória, separada da sessão persistente;
- abas privadas não entram na restauração de sessão;
- abas privadas não entram no histórico/favoritos do MarshMallow;
- URLs privadas não são enviadas para a IA online nem persistidas em grupos;
- câmera, microfone e captura de tela não são liberados automaticamente para páginas privadas.

### Biblioteca
- favoritos locais;
- histórico recente local;
- limpeza do histórico;
- favoritos não são permitidos em aba privada.

### Organização de abas
- A–Z;
- por site/domínio;
- por uso recente;
- por assunto/categoria;
- fechamento de duplicadas;
- agrupamento persistente por URL (somente navegação normal);
- desfazer a última organização;
- drag-and-drop manual.

Categorias locais incluídas: Anime, Música, YouTube, Filmes/Séries, Tecnologia, Compras, Social, Notícias e Outros.

### MarshMallow AI
- comandos locais de organização não gastam requisição online;
- gateway online continua disponível para conversa/ações inteligentes;
- permissões separadas para organizar, abrir páginas, ler página atual, auto-organizar e fechar abas;
- fechamento pode ficar em `Perguntar`, `Permitir` ou `Nunca`;
- histórico local resumido das ações de organização;
- páginas privadas e lista de abas privadas ficam fora da requisição para a IA online.

### Temas e aparência
- Black Piano;
- Sakura Night;
- Neo Tokyo;
- Dark Fantasy;
- Arctic Anime;
- wallpaper personalizado;
- controle de intensidade e desfoque do wallpaper.

### Watch Together + chat
- preserva a captura nativa do frame do player com áudio do mesmo frame;
- preserva LiveKit e o viewer do backend 3.0.6;
- nome do host configurável;
- chat integrado;
- balão de chat NATIVO sobre o `WebContentsView`, sem precisar reduzir a página;
- contador de mensagens não lidas;
- clique esquerdo no balão abre o chat;
- clique direito no balão o oculta até chegar nova mensagem;
- modo de balão oculto persistente;
- no modo persistente, clique direito em uma área livre da página faz o balão reaparecer.

O balão usa um `WebContentsView` transparente próprio e fica acima da página ativa, inclusive sem depender de sobreposição CSS do React.

## Backend

O backend/LiveKit continua compatível com a publicação 3.0.6. Não é necessário republicar o Worker apenas para usar os recursos locais da 3.1.0.

Se o viewer 3.0.6 ainda não estiver publicado, execute:

`PUBLICAR_BACKEND_3.0.6.bat`

## Rodar no Windows

Extraia a pasta e execute:

`INICIAR_MARSHMALLOW_ELECTRON.bat`

Na primeira execução, o script instala as dependências com npm.

## Validar

Execute:

`VALIDAR_MARSHMALLOW_3.1.0.bat`

Ele instala as dependências e executa o typecheck + build web.

## Gerar o instalador

Execute:

`CRIAR_INSTALADOR_ELECTRON.bat`

Saída esperada:

`release\MarshMallow-Setup-3.1.0.exe`

O NSIS cria atalho na Área de Trabalho e no Menu Iniciar.

## Atalhos

- `Ctrl+T`: nova aba (mantém privacidade quando a aba atual é privada)
- `Ctrl+Shift+N`: nova aba privada
- `Ctrl+W`: fechar aba
- `Ctrl+Shift+T`: reabrir aba fechada
- `Ctrl+L`: focar barra de endereço
- `Ctrl+R` / `F5`: recarregar
- `Alt+←` / `Alt+→`: voltar / avançar
- `Ctrl+Shift+M`: MarshMallow AI

## Observação de compilação desta entrega

Os arquivos JavaScript foram validados por parser Node e os arquivos TypeScript/TSX foram validados por parser TypeScript. O ambiente de geração desta entrega não conseguiu resolver o registro npm por DNS, portanto o build completo dependente de `npm install` deve ser executado pelo script de validação no Windows antes da geração do NSIS.
