@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.3.1 - Validacao

echo ============================================
echo   MARSHMALLOW 3.3.1 - VALIDACAO RAPIDA
echo ============================================

echo.
echo [1/3] Validando sintaxe do Electron...
node --check electron\main.mjs || goto :erro
node --check electron\preload.cjs || goto :erro

echo.
echo [2/3] Conferindo a correcao de fullscreen...
findstr /C:"enter-html-full-screen" electron\main.mjs >nul || goto :erro
findstr /C:"leave-html-full-screen" electron\main.mjs >nul || goto :erro
findstr /C:"fullscreenContentBounds" electron\main.mjs >nul || goto :erro

echo.
echo [3/3] Conferindo versao...
findstr /C:"\"version\": \"3.3.1\"" package.json >nul || goto :erro

echo.
echo [OK] MarshMallow 3.3.1 validado.
echo A correcao e local no Electron; nao precisa republicar o backend.
pause
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema.
pause
exit /b 1
