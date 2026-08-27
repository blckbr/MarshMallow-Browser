# MarshMallow 3.0.5 — Cinema Quality

A captura do Electron já funcionava, mas a 3.0.4 publicava vídeo com
`simulcast: true` e sem bitrate explícito.

## Perfil novo

Vídeo:
- H.264;
- simulcast desativado;
- até 8 Mbps;
- até 30 fps;
- preferência `maintain-resolution`;
- prioridade `high`;
- `contentHint = "motion"`;
- captura pede até 1920×1080 / 30 fps.

Áudio:
- `AudioPresets.musicHighQualityStereo`;
- estéreo;
- DTX desativado;
- RED ativado;
- `contentHint = "music"`.

## Viewer

O convidado:
- usa `adaptiveStream: false`;
- solicita explicitamente `VideoQuality.HIGH`;
- solicita 1920×1080 / 30 fps;
- mostra a resolução realmente recebida no status.

## Diagnóstico importante

O host agora mostra algo como:

`Origem capturada: 1920×1080 @ 30 fps`

Se aparecer, por exemplo:

`Origem capturada: 854×480 @ 30 fps`

o limite não é mais bitrate do LiveKit: o próprio WebFrameMain/iframe está
sendo renderizado em 854×480. Nesse caso a próxima correção deve aumentar a
resolução do viewport do iframe antes da captura, em vez de simplesmente
aumentar bitrate.

## Atualização

Extraia por cima de `C:\MarshMallow-Electron`.

Rode:
`npm run electron:dev`

Para que o convidado force qualidade máxima, publique o novo viewer:
`PUBLICAR_BACKEND_3.0.5.bat`
