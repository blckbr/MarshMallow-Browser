@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.3.3 - Validacao

echo.
echo ==============================================================
echo   MARSHMALLOW 3.3.3 - VALIDACAO RAPIDA
echo ==============================================================

echo [1/4] Versao...
findstr /C:"\"version\": \"3.3.3\"" package.json >nul || goto :erro
findstr /C:"version: \"3.3.3\"" src\App.tsx >nul || goto :erro

echo [2/4] UX de chat/IA...
findstr /C:"ref={aiTranscriptRef}" src\App.tsx >nul || goto :erro
findstr /C:"ref={chatLogRef}" src\App.tsx >nul || goto :erro
findstr /C:"event.key === \"Enter\" && !event.shiftKey" src\App.tsx >nul || goto :erro

echo [3/4] Parser e provedores...
findstr /C:"function aiReplyText" backend\src\index.js >nul || goto :erro
findstr /C:"env.GEMINI_API_KEY" backend\src\index.js >nul || goto :erro
findstr /C:"cloudflare-workers-ai" backend\src\index.js >nul || goto :erro

echo [4/4] Scripts...
if not exist "PUBLICAR_BACKEND_3.3.3.bat" goto :erro
if not exist "ATIVAR_GEMINI_3.3.3.bat" goto :erro
if not exist "scripts\validate-backend-3.3.3.ps1" goto :erro

echo.
echo [OK] MarshMallow 3.3.3 validado.
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou arquivo ou implementacao ausente.
exit /b 1
