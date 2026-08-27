@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo ==============================================================
echo   MARSHMALLOW 4.0.2 - DIAGNOSTICO GOOGLE /sorry/
echo ==============================================================
echo.
echo Este teste nao tenta contornar o CAPTCHA do Google.
echo Ele compara o mesmo IP em um navegador nativo e no MarshMallow.
echo.
echo PASSO 1: abrindo Google no navegador padrao do Windows...
start "" "https://www.google.com/"
echo.
echo No navegador que abriu, use uma janela InPrivate/Anonima e visite Google.
echo Anote se aparece "trafego incomum".
echo.
echo PASSO 2: pressione uma tecla para iniciar o MarshMallow 4.0.2.
pause >nul
call "%~dp0INICIAR_MARSHMALLOW_DIRETO.bat"
