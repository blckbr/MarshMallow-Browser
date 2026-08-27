@echo off
cd /d "%~dp0"
title MarshMallow 4.0.6 - Teste ESC na barra
echo ==============================================================
echo   TESTE: ESC RESTAURA URL
 echo ==============================================================
echo.
echo 1. Abra uma pagina qualquer.
echo 2. Apague a URL da barra e pressione ESC.
echo 3. A URL atual deve voltar.
echo 4. Digite outra URL sem abrir e pressione ESC.
echo 5. A URL atual deve voltar novamente.
echo.
pause
call "%~dp0INICIAR_MARSHMALLOW_4.0.6.bat"
