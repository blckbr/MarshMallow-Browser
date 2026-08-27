@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.1.8 - Validacao

echo.
echo ============================================
echo   MARSHMALLOW 3.1.8 - VALIDACAO
echo ============================================
echo.

set FAIL=0

if not exist package.json (echo [ERRO] package.json ausente& set FAIL=1)
if not exist scripts\dev.mjs (echo [ERRO] scripts\dev.mjs ausente& set FAIL=1)
if not exist INICIAR_MARSHMALLOW_ELECTRON.bat (echo [ERRO] launcher ausente& set FAIL=1)
if not exist electron\main.mjs (echo [ERRO] electron\main.mjs ausente& set FAIL=1)
if not exist electron\preload.cjs (echo [ERRO] electron\preload.cjs ausente& set FAIL=1)

findstr /C:"\"version\": \"3.1.8\"" package.json >nul || (echo [ERRO] package.json nao esta em 3.1.8& set FAIL=1)
findstr /C:"electron\\install.js" INICIAR_MARSHMALLOW_ELECTRON.bat >nul || (echo [ERRO] launcher sem reparo automatico do Electron& set FAIL=1)
findstr /C:"ensureElectronBinary" scripts\dev.mjs >nul || (echo [ERRO] dev.mjs sem ensureElectronBinary& set FAIL=1)
findstr /C:"marshmallow-gateway.marshmallow-browser-br.workers.dev" .env.production >nul || (echo [ERRO] backend branded ausente em .env.production& set FAIL=1)
findstr /C:"interfaceFontScale: 130" src\App.tsx >nul || (echo [ERRO] escala de fonte 130%% ausente& set FAIL=1)
findstr /C:"Tamanho da fonte da interface" src\App.tsx >nul || (echo [ERRO] controle de fonte ausente& set FAIL=1)
findstr /C:"--ui-root-font-size: 20.8px" src\styles.css >nul || (echo [ERRO] tipografia padrao ampliada ausente& set FAIL=1)

if "%FAIL%"=="1" (
  echo.
  echo [ERRO] A validacao encontrou problemas.
  pause
  exit /b 1
)

echo [OK] Estrutura 3.1.8 validada.
echo [OK] Correcao de download sob demanda do Electron presente.
echo [OK] Backend branded preservado.
echo [OK] Fonte da interface: padrao 130%%, ajustavel de 100%% a 160%%.
echo.
pause
