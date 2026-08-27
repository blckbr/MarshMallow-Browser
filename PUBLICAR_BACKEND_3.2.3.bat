@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.2.3 - Publicar Backend + IA + Contas

echo.
echo ==============================================================
echo   MARSHMALLOW 3.2.3 - BACKEND + CONTAS + RECUPERACAO
echo ==============================================================
echo.
echo Esta revisao corrige o limite PBKDF2 do Cloudflare Workers.
echo O runtime aceita no maximo 100000 iteracoes; a versao anterior usava 120000.
echo O registro de contas agora tem um nome estavel: accounts-main-v1.
echo.

where node >nul 2>&1 || goto :node_error
where npm.cmd >nul 2>&1 || goto :node_error
where npx.cmd >nul 2>&1 || goto :node_error
where powershell.exe >nul 2>&1 || goto :powershell_error

if not exist "backend\package.json" (
  echo ERRO: backend\package.json nao encontrado.
  pause
  exit /b 1
)

if not exist "scripts\validate-backend-3.2.3.ps1" (
  echo ERRO: scripts\validate-backend-3.2.3.ps1 nao encontrado.
  pause
  exit /b 1
)

pushd backend

echo [1/5] Instalando/sincronizando Wrangler...
call npm.cmd install
if errorlevel 1 goto :deploy_error

echo.
echo [2/5] Conferindo login Cloudflare...
call npx.cmd wrangler whoami >nul 2>&1
if errorlevel 1 (
  echo Abrindo autorizacao Cloudflare...
  call npx.cmd wrangler login
  if errorlevel 1 goto :deploy_error
)

echo.
echo [3/5] Publicando Worker com PBKDF2 compativel...
if exist "..\MARSHMALLOW_3.2.3_DEPLOY.log" del /q "..\MARSHMALLOW_3.2.3_DEPLOY.log" >nul 2>&1
call npx.cmd wrangler deploy > "..\MARSHMALLOW_3.2.3_DEPLOY.log" 2>&1
set "DEPLOY_CODE=!ERRORLEVEL!"
type "..\MARSHMALLOW_3.2.3_DEPLOY.log"
if not "!DEPLOY_CODE!"=="0" goto :deploy_error
popd

set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"
> ".watch_backend_url" echo %MMURL%
> ".env.local" echo VITE_MARSHMALLOW_API_URL=%MMURL%
> ".env.production" echo VITE_MARSHMALLOW_API_URL=%MMURL%

echo.
echo [4/5] Validando PBKDF2, AccountStore e recuperacao...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-backend-3.2.3.ps1" -BaseUrl "%MMURL%"
if errorlevel 1 goto :error

echo.
echo [5/5] Concluido.
echo Backend: %MMURL%
echo PBKDF2: 100000 iteracoes SHA-256
echo Registro: accounts-main-v1
echo.
echo Agora execute INICIAR_MARSHMALLOW_ELECTRON.bat ou deixe o reparador iniciar automaticamente.
echo.
pause
exit /b 0

:deploy_error
popd 2>nul
:error
echo.
echo ERRO: a publicacao/validacao falhou.
echo Consulte MARSHMALLOW_3.2.3_DEPLOY.log se ele tiver sido criado.
pause
exit /b 1

:node_error
echo ERRO: Node.js/npm/npx nao foram encontrados no PATH.
pause
exit /b 1

:powershell_error
echo ERRO: Windows PowerShell nao foi encontrado.
pause
exit /b 1
