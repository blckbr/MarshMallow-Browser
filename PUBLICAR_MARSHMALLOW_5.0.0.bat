@echo off
setlocal
chcp 65001 >nul
title MarshMallow 5.0.0 - Publicacao oficial

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "PS1=%~dp0scripts\windows-publish-5.0.ps1"
if exist "%PS1%" goto :helper_found
set "PS1=%~dp0windows-publish-5.0.ps1"
if exist "%PS1%" (
  for %%I in ("%~dp0..") do set "ROOT=%%~fI"
  goto :helper_found
)

echo [PACOTE_5_COMPLETO] O script windows-publish-5.0.ps1 nao foi encontrado.
echo Extraia o pacote completo MarshMallow 5.0.0 e execute este BAT sem separar os arquivos.
pause
exit /b 2

:helper_found
cd /d "%ROOT%"
echo ==============================================================
echo  MARSHMALLOW 5.0.0 - PUBLICACAO OFICIAL
echo ==============================================================
echo.
echo Este publicador RECUSA publicar se build ou smoke test nao passaram.
echo Alvos: blckbr/MarshMallow-Browser + Cloudflare Pages marshmallow-browser-br.
echo.
set /p "CONFIRM=Digite PUBLICAR para continuar: "
if /I not "%CONFIRM%"=="PUBLICAR" (
  echo [CANCELADO] Nada foi publicado.
  pause
  exit /b 0
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [FALHA/BLOQUEADO] Consulte PUBLICACAO_5.0.0.log.
if "%RC%"=="0" echo [OK] GitHub e site foram confirmados pelo publicador.
pause
exit /b %RC%
