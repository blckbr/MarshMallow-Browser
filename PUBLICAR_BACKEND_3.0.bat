@echo off
setlocal
cd /d "%~dp0backend"
title MarshMallow 3.0 - Publicar Backend
call npm install
if errorlevel 1 goto :erro
call npx wrangler deploy
if errorlevel 1 goto :erro
echo.
echo Backend publicado. Confira:
echo https://marshmallow-gateway.marshmallow-browser-br.workers.dev/health
pause
exit /b 0
:erro
echo.
echo Falha ao publicar o backend.
pause
exit /b 1
