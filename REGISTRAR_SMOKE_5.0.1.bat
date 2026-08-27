@echo off
setlocal
chcp 65001 >nul
title MarshMallow 5.0.1 - Smoke test

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "PS1=%~dp0scripts\windows-smoke-5.0.1.ps1"
if exist "%PS1%" goto :helper_found
set "PS1=%~dp0windows-smoke-5.0.1.ps1"
if exist "%PS1%" (
  for %%I in ("%~dp0..") do set "ROOT=%%~fI"
  goto :helper_found
)

echo [PACOTE_5_COMPLETO] O script windows-smoke-5.0.1.ps1 nao foi encontrado.
echo Extraia o pacote completo MarshMallow 5.0.1 e execute este BAT sem separar os arquivos.
pause
exit /b 2

:helper_found
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [BLOQUEADO] Smoke test nao passou; nao publique.
if "%RC%"=="0" echo [OK] Smoke test passou e foi registrado.
pause
exit /b %RC%
