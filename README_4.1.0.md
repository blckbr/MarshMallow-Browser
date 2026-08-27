# MarshMallow 4.1.0 — Extensões, Modo Desenvolvedor, Downloader de Mídia e Hardening

## Destaques

### Extensões Chromium
- Página interna `marshmallow://extensions`.
- Instalação por pasta descompactada, ZIP, CRX e URL HTTPS.
- Links da Chrome Web Store podem ser importados quando o servidor da loja disponibiliza o pacote CRX.
- Modo desenvolvedor e opção separada para fontes externas.
- Ativar/desativar, recarregar, remover, abrir pasta, permitir `file://` e empacotar ZIP.
- Extensões habilitadas são restauradas no próximo início.
- Abas privadas usam sessões temporárias e não recebem extensões do perfil normal.

> O Electron oferece apenas um subconjunto das APIs de extensões do Chrome. Por isso o MarshMallow informa compatibilidade parcial quando uma extensão exige APIs que o Electron não garante, em vez de prometer 100% de compatibilidade.

### Downloader de mídia
- Botão `↓` na barra com contador de fontes de áudio/vídeo detectadas.
- Detecta arquivos diretos e manifestos HLS/DASH observados pela própria aba.
- Download do arquivo original com a sessão/cookies da aba.
- MP3 e MP4 usam FFmpeg quando `ffmpeg.exe` está disponível no Windows ou em `MarshMallow\bin`.
- Conteúdo protegido por DRM não é descriptografado nem contornado.

### Wallpaper do Windows
- JPEG/PNG continuam funcionando.
- WebP/AVIF e outros formatos exibíveis pelo Chromium ganham conversão de fallback em renderer isolado + canvas antes de serem enviados ao Windows.
- Downloads de wallpaper têm timeout, limite de 40 MB e validação de conteúdo.

## Correções e segurança
- Omnibox não executa esquemas arbitrários como `javascript:`/`data:`.
- Navegação remota do shell principal é bloqueada e convertida em aba normal.
- Downloads não sobrescrevem silenciosamente arquivos já existentes.
- O handler especial de `getDisplayMedia()` do Watch Together é removido ao encerrar a transmissão ou fechar o publisher.
- Pacotes de extensão têm limites de tamanho/quantidade e proteção contra ZIP traversal/ADS.
- Fontes externas de extensão exigem HTTPS e não aceitam credenciais embutidas na URL.
- CSP mais restritiva no shell.
- Backend 3.4.0 aumenta PBKDF2 de novas senhas para 210.000 iterações, preservando contas legadas, limita tentativas de login e tamanhos de payload, reduz detalhes internos devolvidos ao cliente e expira salas Watch abandonadas.
- `F12` e `Ctrl+Shift+I` abrem DevTools; `Ctrl+Shift+E` abre Extensões.

## Publicação
1. Execute `VALIDAR_MARSHMALLOW_4.1.0.bat`.
2. Execute `TESTAR_MARSHMALLOW_4.1.0.bat` e conclua os testes manuais indicados.
3. Execute `CRIAR_INSTALADOR_4.1.0.bat`.
4. O instalador esperado é `release\MarshMallow-Setup-4.1.0.exe`.
5. Para atualizar o Worker, execute `PUBLICAR_BACKEND_3.4.0.bat` somente na conta Cloudflare oficial do projeto.

Criador e desenvolvedor oficial: **Deivison Santos (@devsaex)**.
