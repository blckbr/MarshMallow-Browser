@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.1.5 - Publicar Backend + IA + Contas

echo.
echo ==============================================================
echo   MARSHMALLOW 3.1.5 - BACKEND + WORKERS AI + CONTAS
echo ==============================================================
echo.
echo Esta versao usa Cloudflare Workers AI diretamente.
echo Nao e necessario GEMINI_API_KEY para a IA principal.
echo O plano Free possui uma franquia diaria gratuita do Workers AI.
echo.

where node >nul 2>&1 || goto :node_error
where npm.cmd >nul 2>&1 || goto :node_error
where npx.cmd >nul 2>&1 || goto :node_error

if not exist "backend\package.json" (
  echo ERRO: backend\package.json nao encontrado.
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
echo [3/5] Publicando Worker com Workers AI e AccountStore...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$lines=@(& npx.cmd wrangler deploy 2^>^&1);" ^
  "$code=$LASTEXITCODE;" ^
  "$lines ^| Tee-Object -FilePath '..\MARSHMALLOW_3.1.5_DEPLOY.log' ^| ForEach-Object { Write-Host $_ };" ^
  "if($code-ne 0){exit $code};" ^
  "$text=$lines-join [Environment]::NewLine;" ^
  "$m=[regex]::Matches($text,'https://[A-Za-z0-9.-]+\.workers\.dev(?:/[^\s]*)?');" ^
  "if($m.Count-gt 0){Set-Content '..\.watch_backend_url' $m[$m.Count-1].Value.TrimEnd('/') -Encoding ASCII}"
if errorlevel 1 goto :deploy_error
popd

set "MMURL="
if exist ".watch_backend_url" for /f "usebackq delims=" %%U in (".watch_backend_url") do set "MMURL=%%U"
if not defined MMURL set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"

> ".env.local" echo VITE_MARSHMALLOW_API_URL=%MMURL%
> ".env.production" echo VITE_MARSHMALLOW_API_URL=%MMURL%

echo.
echo [4/5] Validando IA gratuita e backend...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$base='%MMURL%';" ^
  "$h=Invoke-RestMethod -Uri ($base+'/health?_mm='+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -TimeoutSec 30 -Headers @{'Cache-Control'='no-cache'};" ^
  "if(-not $h.ok){throw 'Health falhou'};" ^
  "if(-not $h.workersAiConfigured){throw 'Workers AI binding nao foi ativado'};" ^
  "Write-Host ('[OK] AI provider: '+$h.aiProvider) -ForegroundColor Green;" ^
  "Write-Host ('[OK] Modelo: '+$h.model) -ForegroundColor Green;" ^
  "$authOk=$false; try{Invoke-RestMethod -Uri ($base+'/api/auth/session') -Method Get -TimeoutSec 20 ^| Out-Null}catch{if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401){$authOk=$true}else{throw}};" ^
  "if(-not $authOk){throw 'Rota de contas nao exigiu sessao como esperado'};" ^
  "Write-Host '[OK] Cadastro/login online ativo' -ForegroundColor Green"
if errorlevel 1 goto :error

echo.
echo [5/5] Concluido.
echo Backend: %MMURL%
echo.
echo Agora execute INICIAR_MARSHMALLOW_ELECTRON.bat.
echo No primeiro acesso aparecera a tela Criar conta / Entrar.
echo.
pause
exit /b 0

:deploy_error
popd 2>nul
:error
echo.
echo ERRO: a publicacao/validacao falhou.
echo Consulte MARSHMALLOW_3.1.5_DEPLOY.log se ele tiver sido criado.
pause
exit /b 1

:node_error
echo ERRO: Node.js/npm/npx nao foram encontrados no PATH.
pause
exit /b 1
