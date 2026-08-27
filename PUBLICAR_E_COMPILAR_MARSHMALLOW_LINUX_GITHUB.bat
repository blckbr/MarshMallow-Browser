@echo off
setlocal EnableExtensions
chcp 65001 >nul
title MarshMallow 5.0.2 - Linux GitHub Actions

echo ==============================================================
echo  MARSHMALLOW 5.0.2 - COMPILAR LINUX NO GITHUB ACTIONS
echo ==============================================================
echo.
echo Este processo NAO precisa de uma maquina Linux local.
echo Ele envia uma branch isolada ao repositorio oficial,
echo aguarda o GitHub Actions e baixa RPM + AppImage para o Desktop.
echo.
echo Ele NAO altera a branch principal e NAO cria GitHub Release.
echo.

set "ROOT=%~dp0"
set "PS1=%ROOT%scripts\windows-publish-linux-ci-5.0.2.ps1"

if not exist "%PS1%" (
  echo [FALHA] Script nao encontrado:
  echo         %PS1%
  pause
  exit /b 2
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"

echo.
echo Codigo de saida: %RC%
if "%RC%"=="0" (
  echo [OK] Processo concluido. Confira a pasta MarshMallow-Linux-5.0.2 no Desktop.
) else (
  echo [FALHA] O processo foi interrompido com seguranca.
)
pause
exit /b %RC%
