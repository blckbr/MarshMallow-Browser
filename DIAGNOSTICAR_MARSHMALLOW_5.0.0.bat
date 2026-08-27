@echo off
setlocal
chcp 65001 >nul
title MarshMallow 5.0.0 - Diagnostico

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "PS1=%~dp0scripts\windows-diagnostic-5.0.ps1"
if exist "%PS1%" goto :helper_found
set "PS1=%~dp0windows-diagnostic-5.0.ps1"
if exist "%PS1%" (
  for %%I in ("%~dp0..") do set "ROOT=%%~fI"
  goto :helper_found
)

echo [PACOTE_5_COMPLETO] O script windows-diagnostic-5.0.ps1 nao foi encontrado.
echo Extraia o pacote completo MarshMallow 5.0.0 e execute este BAT sem separar os arquivos.
pause
exit /b 2

:helper_found
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
pause
exit /b %RC%
