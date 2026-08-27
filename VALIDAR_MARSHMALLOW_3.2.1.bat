@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.2.1 - Validacao
set "FAIL=0"

echo.
echo ==============================================================
echo   MARSHMALLOW 3.2.1 - VALIDACAO LOCAL
echo ==============================================================
echo.

findstr /C:"\"version\": \"3.2.1\"" package.json >nul || (echo [ERRO] package.json nao esta em 3.2.1& set FAIL=1)
findstr /C:"const VERSION = \"3.2.1\"" electron\main.mjs >nul || (echo [ERRO] electron main nao esta em 3.2.1& set FAIL=1)
findstr /C:"version: \"3.2.1\"" electron\preload.cjs >nul || (echo [ERRO] preload nao esta em 3.2.1& set FAIL=1)
findstr /C:"backendVersion: \"3.2.1\"" backend\src\index.js >nul || (echo [ERRO] backend nao esta em 3.2.1& set FAIL=1)
if not exist REPARAR_CONTAS_3.2.1.bat (echo [ERRO] reparador 3.2.1 ausente& set FAIL=1)
if not exist PUBLICAR_BACKEND_3.2.1.bat (echo [ERRO] publicador 3.2.1 ausente& set FAIL=1)
if not exist scripts\validate-backend-3.2.1.ps1 (echo [ERRO] validador PowerShell ausente& set FAIL=1)
findstr /C:"marshmallow-gateway.marshmallow-browser-br.workers.dev" PUBLICAR_BACKEND_3.2.1.bat >nul || (echo [ERRO] backend oficial ausente do publicador& set FAIL=1)
findstr /C:"wrangler deploy ^> \"..\MARSHMALLOW_3.2.1_DEPLOY.log\" 2^>^&1" PUBLICAR_BACKEND_3.2.1.bat >nul || echo [INFO] Deploy usa redirecionamento CMD direto.

if "%FAIL%"=="1" (
  echo.
  echo [ERRO] A estrutura 3.2.1 possui falhas.
  pause
  exit /b 1
)

echo [OK] Estrutura 3.2.1 validada.
pause
exit /b 0
