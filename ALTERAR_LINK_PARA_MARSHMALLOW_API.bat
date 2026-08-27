@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MarshMallow - Alterar workers.dev pela API Cloudflare

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1"
set "MMEXIT=%ERRORLEVEL%"

echo.
if "%MMEXIT%"=="0" (
  echo [OK] Processo concluido.
) else (
  echo [ERRO] A alteracao nao foi concluida.
)
echo.
pause
exit /b %MMEXIT%
