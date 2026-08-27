@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.3 - Teste Login Google YouTube

echo ==============================================================
echo   MARSHMALLOW 4.0.3 - TESTE GOOGLE / YOUTUBE
 echo ==============================================================
echo.
echo 1. O MarshMallow sera iniciado.
echo 2. Abra https://www.youtube.com/
echo 3. Clique em Fazer login.
echo 4. Conclua o login DENTRO do MarshMallow.
echo 5. Abra Configuracoes ^> Cookies e dados.
echo 6. Pesquise por youtube e google.
echo 7. Clique em Salvar cookies agora.
echo 8. Feche e abra o navegador para testar persistencia.
echo.
pause
call "%~dp0INICIAR_MARSHMALLOW_4.0.3.bat"
