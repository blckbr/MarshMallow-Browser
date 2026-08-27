# MarshMallow 3.0.3 — Publisher Handshake + Diagnostics

Corrige a tela ficar apenas em:

`STOPPED · Publisher LiveKit encerrado.`

## Bug corrigido

O publisher fazia:
1. envia status `error`;
2. chama `stop()`;
3. `stop()` envia `stopped`.

O erro real era apagado.

Agora:
- erro permanece como estado final;
- cleanup não substitui erro;
- PowerShell imprime cada etapa `[Watch ...]`;
- painel possui "Diagnóstico da transmissão".

## Handshake

A janela oculta do publisher envia `watch-host:ready` somente depois de instalar
os listeners IPC. O processo principal espera esse handshake antes de enviar o
token e mandar começar.

Isso elimina a possibilidade de perder o primeiro `watch-host:start`.

## Diagnóstico de getDisplayMedia

O processo principal agora mostra:
- `display-request`;
- `display-denied`, com motivo;
- `display-granted`, com URL do WebFrameMain;
- `capture-granted`, com quantidade de tracks;
- `publish-video`;
- `publish-audio`;
- `live`.

Se der erro, a causa exata permanece na interface e também no PowerShell.

## Constraints simplificadas

O renderer solicita apenas `video: true, audio: true`. A fonte exata continua sendo concedida pelo processo principal como WebFrameMain.
