@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MarshMallow 5.0.2 - Validar e compilar

set "TARGET=C:\MarshMallow-5.0.0-Source"
for %%I in ("%~dp0.") do set "HERE=%%~fI"
set "ROOT="

rem A pasta extraida de publicacao tambem possui package.json/scripts.
rem So a fonte canonica possui estes arquivos historicos usados pela suite.
if exist "%HERE%\scripts\windows-smoke-5.0.ps1" if exist "%HERE%\MarshMallow-Official-Website-5.0.0\site\download\manager.json" set "ROOT=%HERE%"
if not defined ROOT if exist "%TARGET%\scripts\windows-smoke-5.0.ps1" if exist "%TARGET%\MarshMallow-Official-Website-5.0.0\site\download\manager.json" set "ROOT=%TARGET%"

if not defined ROOT (
  echo [FALHA] A fonte canonica do MarshMallow nao foi encontrada.
  echo Esperado: %TARGET%
  echo Execute primeiro APLICAR_MARSHMALLOW_5.0.2.bat.
  pause
  exit /b 2
)

set "PS1=%ROOT%\scripts\windows-build-5.0.2.ps1"
if not exist "%PS1%" (
  echo [FALHA] A 5.0.2 ainda nao esta aplicada na fonte canonica:
  echo         %ROOT%
  echo Execute primeiro APLICAR_MARSHMALLOW_5.0.2.bat.
  pause
  exit /b 2
)

if /I not "%HERE%"=="%ROOT%" (
  echo [INFO] Launcher aberto fora do projeto.
  echo [INFO] Redirecionando automaticamente para: %ROOT%
  echo.
)
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [FALHA] A compilacao/validacao nao passou. Nada foi publicado.
) else (
  echo [OK] Build 5.0.2 criado e validado automaticamente.
  echo Agora execute REGISTRAR_SMOKE_5.0.2.bat e teste o navegador no Windows.
)
pause
exit /b %RC%
