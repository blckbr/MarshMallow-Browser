@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 2.0 - Configurar LiveKit
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0CONFIGURAR_LIVEKIT_2.0.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel configurar o LiveKit.
  pause
  exit /b 1
)
exit /b 0
