@echo off
setlocal
cd /d "%~dp0"
title MarshMallow Browser - Validar MSIX
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-msix.ps1"
set RC=%ERRORLEVEL%
echo.
pause
exit /b %RC%
