@echo off
cd /d "%~dp0"
echo MarshMallow 4.0.13 - Wallpaper do Windows e ferramentas da IA
echo.
echo 1. Abra uma nova aba e escolha um wallpaper.
echo 2. Teste Baixar, Windows e Bloqueio.
echo 3. Abra duas ou mais abas e deixe uma delas reproduzindo audio.
echo 4. Abra MarshMallow AI e clique em De qual aba vem o som.
echo 5. Clique em Diminuir consumo de RAM.
echo 6. Confirme que a aba atual continua aberta e as demais ficam suspensas.
echo 7. Clique numa aba suspensa e confirme que ela recarrega normalmente.
echo.
pause
call npm run electron:dev
