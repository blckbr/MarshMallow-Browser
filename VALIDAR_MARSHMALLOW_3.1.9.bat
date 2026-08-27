@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.1.9 - Validacao

echo.
echo ============================================
echo   MARSHMALLOW 3.1.9 - VALIDACAO
echo ============================================
echo.

set FAIL=0

if not exist package.json (echo [ERRO] package.json ausente& set FAIL=1)
if not exist scripts\dev.mjs (echo [ERRO] scripts\dev.mjs ausente& set FAIL=1)
if not exist INICIAR_MARSHMALLOW_ELECTRON.bat (echo [ERRO] launcher ausente& set FAIL=1)
if not exist electron\main.mjs (echo [ERRO] electron\main.mjs ausente& set FAIL=1)
if not exist electron\preload.cjs (echo [ERRO] electron\preload.cjs ausente& set FAIL=1)

findstr /C:"\"version\": \"3.1.9\"" package.json >nul || (echo [ERRO] package.json nao esta em 3.1.9& set FAIL=1)
findstr /C:"electron\\install.js" INICIAR_MARSHMALLOW_ELECTRON.bat >nul || (echo [ERRO] launcher sem reparo automatico do Electron& set FAIL=1)
findstr /C:"ensureElectronBinary" scripts\dev.mjs >nul || (echo [ERRO] dev.mjs sem ensureElectronBinary& set FAIL=1)
findstr /C:"marshmallow-gateway.marshmallow-browser-br.workers.dev" .env.production >nul || (echo [ERRO] backend branded ausente em .env.production& set FAIL=1)
findstr /C:"interfaceFontScale: 130" src\App.tsx >nul || (echo [ERRO] escala de fonte 130%% ausente& set FAIL=1)
findstr /C:"Tamanho da fonte da interface" src\App.tsx >nul || (echo [ERRO] controle de fonte ausente& set FAIL=1)
findstr /C:"--ui-root-font-size: 20.8px" src\styles.css >nul || (echo [ERRO] tipografia padrao ampliada ausente& set FAIL=1)
findstr /C:"backend:request" electron\main.mjs >nul || (echo [ERRO] ponte nativa de backend ausente no main& set FAIL=1)
findstr /C:"backend:request" electron\preload.cjs >nul || (echo [ERRO] ponte nativa de backend ausente no preload& set FAIL=1)
findstr /C:"callBackend" src\App.tsx >nul || (echo [ERRO] frontend nao usa ponte nativa no cadastro& set FAIL=1)
findstr /C:"backendVersion:" backend\src\index.js >nul || (echo [ERRO] backendVersion ausente& set FAIL=1)
findstr /C:"/api/auth/ping" backend\src\index.js >nul || (echo [ERRO] autoteste AccountStore ausente& set FAIL=1)
findstr /C:"AccountStore" backend\src\index.js >nul || (echo [ERRO] diagnostico de AccountStore ausente& set FAIL=1)
if not exist REPARAR_CADASTRO_3.1.9.bat (echo [ERRO] reparador de cadastro ausente& set FAIL=1)
if not exist PUBLICAR_BACKEND_3.1.9.bat (echo [ERRO] publicador 3.1.9 ausente& set FAIL=1)

if "%FAIL%"=="1" (
  echo.
  echo [ERRO] A validacao encontrou problemas.
  pause
  exit /b 1
)

echo [OK] Estrutura 3.1.9 validada.
echo [OK] Cadastro/login usa ponte nativa Electron net.fetch.
echo [OK] AccountStore possui autoteste e diagnostico JSON.
echo [OK] Correcao de download sob demanda do Electron presente.
echo [OK] Backend branded preservado.
echo [OK] Fonte da interface: padrao 130%%, ajustavel de 100%% a 160%%.
echo.
pause
