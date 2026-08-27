@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.3.2 - Validacao

echo ============================================
echo   MARSHMALLOW 3.3.2 - VALIDACAO RAPIDA
echo ============================================

echo [1/4] Verificando versao...
findstr /C:"\"version\": \"3.3.2\"" package.json >nul || goto :erro

echo [2/4] Verificando suporte a abas internas...
findstr /C:"browser:new-internal-tab" electron\main.mjs >nul || goto :erro
findstr /C:"newInternalTab" electron\preload.cjs >nul || goto :erro
findstr /C:"internalPage?: InternalPageId" src\types.ts >nul || goto :erro

echo [3/4] Verificando paginas solicitadas...
findstr /C:"marshmallow://library" electron\main.mjs >nul || goto :erro
findstr /C:"marshmallow://themes" electron\main.mjs >nul || goto :erro
findstr /C:"marshmallow://settings" electron\main.mjs >nul || goto :erro
findstr /C:"openInternalPage(\"library\")" src\App.tsx >nul || goto :erro
findstr /C:"openInternalPage(\"themes\")" src\App.tsx >nul || goto :erro
findstr /C:"openInternalPage(\"settings\")" src\App.tsx >nul || goto :erro

echo [4/4] Verificando sintaxe JavaScript...
node --check electron\main.mjs || goto :erro
node --check electron\preload.cjs || goto :erro

echo.
echo [OK] MarshMallow 3.3.2 validado.
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema.
exit /b 1
