@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.5 - Teste Nova Aba

echo ==============================================================
echo   MARSHMALLOW 4.0.5 - TESTE NOVA ABA + WALLPAPER
echo ==============================================================
echo.
echo 1. O MarshMallow abrira agora.
echo 2. Crie uma nova aba com Ctrl+T ou pelo botao +.
echo 3. A pagina deve ficar limpa, sem abrir o Google automaticamente.
echo 4. Se ainda nao houver wallpaper, escolha uma imagem pelo convite.
echo 5. Abra outra nova aba: o wallpaper deve aparecer.
echo 6. Digite go ou gm na barra para testar o preenchimento inteligente.
echo.
pause
call "%~dp0INICIAR_MARSHMALLOW_4.0.5.bat"
