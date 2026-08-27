@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MarshMallow 5.0.1 - Atualizar fonte e site

echo ==============================================================
echo  MARSHMALLOW 5.0.1 - PREPARAR PUBLICACAO
echo ==============================================================
echo.

echo Este processo cria backup, aplica a fonte 5.0.1, contador neon,
echo site/GitHub 5.0.1 e valida testes + TypeScript + build web.
echo.

set "ZIP=%~dp0MarshMallow-5.0.1-Source-Publicacao.zip"
set "TARGET=C:\MarshMallow-5.0.0-Source"
if exist "%~dp0package.json" set "TARGET=%~dp0."

if not exist "%ZIP%" (
  echo [FALHA] Coloque este BAT ao lado de:
  echo         MarshMallow-5.0.1-Source-Publicacao.zip
  pause
  exit /b 2
)
if not exist "%TARGET%\package.json" (
  echo [FALHA] Projeto nao encontrado em: %TARGET%
  echo Coloque o BAT dentro do projeto ou mantenha o projeto em C:\MarshMallow-5.0.0-Source
  pause
  exit /b 2
)

set "TMP=%TEMP%\MarshMallow-501-%RANDOM%-%RANDOM%"
mkdir "%TMP%" >nul 2>&1

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force"
if errorlevel 1 (
  echo [FALHA] Nao foi possivel extrair o ZIP.
  rd /s /q "%TMP%" >nul 2>&1
  pause
  exit /b 1
)

set "SOURCE=%TMP%\MarshMallow-5.0.1-Source"
set "PS1=%SOURCE%\scripts\windows-apply-5.0.1.ps1"
if not exist "%PS1%" (
  echo [FALHA] O ZIP nao possui a estrutura MarshMallow-5.0.1-Source esperada.
  rd /s /q "%TMP%" >nul 2>&1
  pause
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -TargetRoot "%TARGET%" -SourceRoot "%SOURCE%"
set "RC=%ERRORLEVEL%"
rd /s /q "%TMP%" >nul 2>&1

echo.
echo Codigo de saida: %RC%
if not "%RC%"=="0" echo [FALHA] A atualizacao nao foi liberada; consulte a mensagem acima.
if "%RC%"=="0" echo [OK] Fonte 5.0.1 pronta para compilar e publicar.
pause
exit /b %RC%
