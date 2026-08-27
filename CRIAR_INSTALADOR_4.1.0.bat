@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.1.0 - Criar instalador

echo ==============================================================
echo   MARSHMALLOW 4.1.0 - INSTALADOR WINDOWS
echo ==============================================================
echo.

call "%~dp0VALIDAR_MARSHMALLOW_4.1.0.bat"
if errorlevel 1 goto :fail

echo.
echo Gerando instalador NSIS...
call npx electron-builder --win nsis
if errorlevel 1 goto :fail

set "OUT=%~dp0release\MarshMallow-Setup-4.1.0.exe"
if not exist "%OUT%" goto :missing

echo.
echo [OK] Instalador gerado:
echo %OUT%
certutil -hashfile "%OUT%" SHA256 > "%OUT%.sha256.txt"
start "" explorer.exe /select,"%OUT%"
exit /b 0

:missing
echo [ERRO] O build terminou sem criar o arquivo esperado: %OUT%
exit /b 1

:fail
echo [ERRO] Instalador nao foi publicado/substituido.
exit /b 1
