@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo  MARSHMALLOW BROWSER - ASSISTENTE MICROSOFT STORE
echo  Primeiro envio / preparacao segura
echo ==============================================================
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERRO] PowerShell nao encontrado.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARAR_STORE.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [ERRO] O assistente terminou com codigo %RC%.
  pause
  exit /b %RC%
)

echo.
echo [OK] Preparacao concluida.
echo A pasta de saida foi aberta. Leia primeiro 00-LEIA-ME.txt.
echo.
pause
exit /b 0
