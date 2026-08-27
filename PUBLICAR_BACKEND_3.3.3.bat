@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.3.3 - Atualizar IA

echo.
echo ==============================================================
echo   MARSHMALLOW 3.3.3 - IA GERAL + RESPOSTAS CORRETAS
echo ==============================================================
echo.
echo Esta atualizacao corrige respostas [object Object], mantem o clima
echo direto via Open-Meteo e faz a IA responder perguntas gerais.
echo Se GEMINI_API_KEY estiver configurada, Gemini sera o provedor principal.
echo Caso contrario, Workers AI continuara funcionando como provedor geral.
echo.

where node >nul 2>&1 || goto :node_error
where npm.cmd >nul 2>&1 || goto :node_error
where npx.cmd >nul 2>&1 || goto :node_error
where powershell.exe >nul 2>&1 || goto :powershell_error

pushd backend
echo [1/4] Sincronizando Wrangler...
call npm.cmd install
if errorlevel 1 goto :deploy_error

echo.
echo [2/4] Conferindo login Cloudflare...
call npx.cmd wrangler whoami >nul 2>&1
if errorlevel 1 (
  call npx.cmd wrangler login
  if errorlevel 1 goto :deploy_error
)

echo.
echo [3/4] Publicando backend 3.3.3...
if exist "..\MARSHMALLOW_3.3.3_DEPLOY.log" del /q "..\MARSHMALLOW_3.3.3_DEPLOY.log" >nul 2>&1
call npx.cmd wrangler deploy > "..\MARSHMALLOW_3.3.3_DEPLOY.log" 2>&1
set "DEPLOY_CODE=!ERRORLEVEL!"
type "..\MARSHMALLOW_3.3.3_DEPLOY.log"
if not "!DEPLOY_CODE!"=="0" goto :deploy_error
popd

set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"
> ".watch_backend_url" echo %MMURL%
> ".env.local" echo VITE_MARSHMALLOW_API_URL=%MMURL%
> ".env.production" echo VITE_MARSHMALLOW_API_URL=%MMURL%

echo.
echo [4/4] Testando uma pergunta geral...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-backend-3.3.3.ps1" -BaseUrl "%MMURL%"
if errorlevel 1 goto :error

echo.
echo [OK] IA 3.3.3 publicada e validada.
echo.
echo Se quiser Gemini como provedor PRINCIPAL, execute:
echo   ATIVAR_GEMINI_3.3.3.bat
echo.
pause
exit /b 0

:deploy_error
popd 2>nul
:error
echo.
echo ERRO: a atualizacao da IA nao foi concluida.
echo Consulte MARSHMALLOW_3.3.3_DEPLOY.log se ele existir.
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
