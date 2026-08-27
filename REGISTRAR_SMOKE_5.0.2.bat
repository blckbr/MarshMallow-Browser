@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MarshMallow 5.0.2 - Smoke test

set "TARGET=C:\MarshMallow-5.0.0-Source"
for %%I in ("%~dp0.") do set "HERE=%%~fI"
set "ROOT="
if exist "%HERE%\scripts\windows-smoke-5.0.ps1" if exist "%HERE%\MarshMallow-Official-Website-5.0.0\site\download\manager.json" set "ROOT=%HERE%"
if not defined ROOT if exist "%TARGET%\scripts\windows-smoke-5.0.ps1" if exist "%TARGET%\MarshMallow-Official-Website-5.0.0\site\download\manager.json" set "ROOT=%TARGET%"
if not defined ROOT (
  echo [FALHA] A fonte canonica nao foi encontrada em %TARGET%.
  pause
  exit /b 2
)
set "PS1=%ROOT%\scripts\windows-smoke-5.0.2.ps1"
if not exist "%PS1%" (
  echo [FALHA] A 5.0.2 ainda nao esta aplicada na fonte canonica.
  pause
  exit /b 2
)
if /I not "%HERE%"=="%ROOT%" echo [INFO] Redirecionando para %ROOT%
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" echo [BLOQUEADO] Smoke test nao passou; nao publique.
if "%RC%"=="0" echo [OK] Smoke test passou e foi registrado.
pause
exit /b %RC%
