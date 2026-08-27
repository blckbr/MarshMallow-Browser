# MarshMallow 3.0.0 — Electron Core

Esta é a primeira base integralmente Electron do MarshMallow.

## O que foi removido

O runtime Tauri/WebView2 deixa de ser necessário.

O Watch Together NÃO usa:
- `blob:` discovery;
- HLS/m3u8;
- canvas;
- CropTarget;
- `captureStream()` do site;
- sincronização por `currentTime`;
- captura de desktop;
- áudio loopback do Windows.

## Browser Core

Cada aba externa é um `WebContentsView` real.

O Electron 43 usa Chromium 150 e Node 24. O `BrowserView` antigo está
descontinuado; por isso esta migração já usa `WebContentsView`.

Implementado:
- abas verticais;
- modo compacto;
- múltiplos WebContents;
- voltar / avançar / atualizar;
- Ctrl+T;
- Ctrl+W;
- Ctrl+Shift+T;
- Ctrl+L;
- Ctrl+R / F5;
- Alt+← / Alt+→;
- Ctrl+Shift+M para MarshMallow AI;
- target=_blank / window.open em nova aba;
- menu de contexto nativo da página;
- atualizar recarrega somente a página;
- persistência simples da sessão;
- favicon / título / áudio por aba;
- controles da janela somente estilo macOS;
- instalador NSIS com atalho.

## Watch Together — captura estilo Fluxer

A parte decisiva usa uma API suportada pelo próprio Electron:

`session.setDisplayMediaRequestHandler()`

O Electron permite conceder um `WebFrameMain` diretamente como fonte de:
- vídeo;
- áudio.

O MarshMallow percorre:

`activeTab.webContents.mainFrame.framesInSubtree`

e executa uma sonda em cada frame para descobrir qual contém o maior `<video>`
e qual está reproduzindo.

O frame vencedor é entregue ao publisher:

```text
WebContentsView da aba
       ↓
frame/iframe com o player
       ↓
WebFrameMain
       ↓
getDisplayMedia()
       ↓
vídeo + áudio DO MESMO FRAME
       ↓
LiveKit
       ↓
convidado PC/celular
```

Não é usado `audio: "loopback"`. Portanto o Watch Together não pede a mixagem
geral do Windows.

### Modo de vídeo limpo

Antes da captura, o MarshMallow executa JavaScript diretamente no frame
selecionado e coloca o maior `<video>` sobre todo o frame, fundo preto.

Isso serve para frames que contêm controles/página ao redor do vídeo.
Ao encerrar a transmissão, os estilos originais são restaurados.

## Backend

Cloudflare continua responsável por:
- criação da sala;
- link universal;
- chat;
- histórico;
- token temporário LiveKit.

LiveKit continua responsável pela distribuição WebRTC aos convidados.

## Primeira execução

1. Extraia em `C:\MarshMallow`.
2. Execute `INICIAR_MARSHMALLOW_ELECTRON.bat`.
3. O script instala Electron e dependências.
4. O navegador abre já no novo runtime.

As credenciais LiveKit já configuradas no Worker não precisam ser recriadas.

Se for necessário publicar o backend 3.0:
`PUBLICAR_BACKEND_3.0.bat`

## Instalador

Execute:
`CRIAR_INSTALADOR_ELECTRON.bat`

O resultado fica em `release/`.

## Observação de migração

Esta base prioriza o motor do navegador e Watch Together, porque são as partes
que dependem diretamente da troca Tauri → Electron.

A interface Black Piano, controles macOS, AI básica e Watch/chat já estão
presentes. Recursos periféricos antigos podem ser portados para esta mesma
arquitetura sem reintroduzir WebView2/Rust.
