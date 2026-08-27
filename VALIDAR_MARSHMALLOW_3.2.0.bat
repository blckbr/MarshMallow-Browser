@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.2.0 - Validacao
set FAIL=0

echo.
echo ==============================================================
echo   MARSHMALLOW 3.2.0 - VALIDACAO LOCAL
echo ==============================================================
echo.

findstr /C:"\"version\": \"3.2.0\"" package.json >nul || (echo [ERRO] package.json nao esta em 3.2.0& set FAIL=1)
findstr /C:"const VERSION = \"3.2.0\"" electron\main.mjs >nul || (echo [ERRO] electron main nao esta em 3.2.0& set FAIL=1)
findstr /C:"registry-v3-2" backend\src\index.js >nul || (echo [ERRO] registro novo de contas ausente& set FAIL=1)
findstr /C:"/recover" backend\src\index.js >nul || (echo [ERRO] recuperacao no backend ausente& set FAIL=1)
findstr /C:"recoveryCode" src\App.tsx >nul || (echo [ERRO] interface de recuperacao ausente& set FAIL=1)
findstr /C:"marshmallow-gateway.marshmallow-browser-br.workers.dev" electron\main.mjs >nul || (echo [ERRO] backend oficial incorreto& set FAIL=1)
if not exist REPARAR_CONTAS_3.2.0.bat (echo [ERRO] reparador 3.2.0 ausente& set FAIL=1)
if not exist PUBLICAR_BACKEND_3.2.0.bat (echo [ERRO] publicador 3.2.0 ausente& set FAIL=1)

if "%FAIL%"=="1" (
  echo.
  echo [ERRO] A estrutura local falhou na validacao.
  exit /b 1
)

echo [OK] Estrutura 3.2.0 validada.
exit /b 0
