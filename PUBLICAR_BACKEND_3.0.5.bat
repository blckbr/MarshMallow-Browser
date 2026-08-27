@echo off
setlocal
cd /d "%~dp0backend"
title MarshMallow 3.0.5 - Publicar Backend Cinema
echo.
echo ============================================
echo   MarshMallow 3.0.5 - Backend / Viewer
echo ============================================
echo.
call npm install
if errorlevel 1 goto :erro
call npx wrangler deploy
if errorlevel 1 goto :erro
echo.
echo Backend/Viewer 3.0.5 publicado com qualidade maxima.
echo.
pause
exit /b 0
:erro
echo.
echo Falha ao publicar o backend.
pause
exit /b 1
