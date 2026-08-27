@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 5.0.0 - Republicar somente o site

echo ==============================================================
echo  MARSHMALLOW 5.0.0 - REPUBLICAR SOMENTE O SITE
echo ==============================================================
echo.
echo Nao recompila o navegador.
echo Nao faz git push.
echo Nao cria Release.
echo Nao reenvia o instalador de 110 MB.
echo.
echo Corrige version.json/release.json para UTF-8 sem BOM e publica
 echo somente o Cloudflare Pages.
echo.
set /p CONFIRM=Digite SITE para continuar: 
if /I not "%CONFIRM%"=="SITE" (
  echo.
  echo Operacao cancelada.
  pause
  exit /b 1
)

echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-republish-site-5.0.ps1" -Root "%~dp0"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [SUCESSO] Site e metadados confirmados.
) else (
  echo [FALHA] Consulte REPUBLICACAO_SITE_5.0.0.log.
)
pause
exit /b %RC%
