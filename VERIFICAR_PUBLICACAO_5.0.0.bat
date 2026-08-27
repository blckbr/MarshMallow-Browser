@echo off
setlocal
chcp 65001 >nul
title MarshMallow 5.0.0 - Verificar publicacao

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "PS1=%~dp0scripts\windows-verify-publication-5.0.ps1"
if exist "%PS1%" goto :helper_found
set "PS1=%~dp0windows-verify-publication-5.0.ps1"
if exist "%PS1%" (
  for %%I in ("%~dp0..") do set "ROOT=%%~fI"
  goto :helper_found
)

echo [PACOTE_5_COMPLETO] O script windows-verify-publication-5.0.ps1 nao foi encontrado.
echo Extraia o patch na pasta do MarshMallow 5.0.0 sem separar os arquivos.
pause
exit /b 2

:helper_found
cd /d "%ROOT%"
echo ==============================================================
echo  MARSHMALLOW 5.0.0 - VERIFICACAO DA PUBLICACAO
echo ==============================================================
echo.
echo Este teste e SOMENTE LEITURA.
echo Nao faz push, upload, release nem deploy.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [FALHA] Consulte VERIFICACAO_PUBLICACAO_5.0.0.log.
if "%RC%"=="0" echo [OK] GitHub e site estao publicados e correspondem ao instalador validado.
pause
exit /b %RC%
