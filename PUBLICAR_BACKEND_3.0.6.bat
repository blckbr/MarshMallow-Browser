@echo off
setlocal
cd /d "%~dp0backend"
title MarshMallow 3.0.6 - Publicar Viewer
echo.
echo ============================================
echo   MarshMallow 3.0.6 - Viewer / Volume
echo ============================================
echo.
call npm install
if errorlevel 1 goto :erro
call npx wrangler deploy
if errorlevel 1 goto :erro
echo.
echo Viewer 3.0.6 publicado.
echo Volume inicial do convidado: 30%%.
echo.
pause
exit /b 0
:erro
echo.
echo Falha ao publicar o backend.
pause
exit /b 1
