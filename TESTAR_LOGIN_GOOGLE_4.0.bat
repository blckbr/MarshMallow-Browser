@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 4.0 - Testar login Google

echo ==============================================================
echo   MARSHMALLOW 4.0 - TESTE DE LOGIN NATIVO DO GOOGLE
echo ==============================================================
echo.
echo Este teste abre accounts.google.com diretamente no Microsoft Edge,
echo sem WebView, CEF, automacao ou falsificacao de User-Agent.
echo.
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --new-window "https://accounts.google.com/"
  echo [OK] Microsoft Edge aberto.
  echo Se o Google aceitar o login aqui, o modo nativo do MarshMallow 4.0 esta apto.
  pause
  exit /b 0
)

echo Microsoft Edge nao foi localizado. Abrindo no navegador padrao...
start "" "https://accounts.google.com/"
pause
