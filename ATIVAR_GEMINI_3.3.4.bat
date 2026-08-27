@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title MarshMallow 3.3.4 - Ativar Gemini

set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"

echo.
echo ==============================================================
echo   MARSHMALLOW 3.3.4 - GEMINI COMO IA PRINCIPAL
echo ==============================================================
echo.
echo CORRECAO 3.3.4:
echo O comando "wrangler secret put" JA cria e publica uma nova versao.
echo Por isso nao faremos outro "wrangler deploy" DEPOIS de salvar a chave.
echo.
echo A chave sera salva como Secret do Cloudflare Worker.
echo Ela NAO vai para o instalador e NAO e enviada aos usuarios.
echo.
echo Modelo principal: gemini-3.5-flash-lite
echo Fallback: Workers AI da Cloudflare
echo.
choice /C SN /N /M "Ja possui uma Gemini API Key? [S/N]: "
if errorlevel 2 (
  echo.
  echo Abrindo o Google AI Studio para criar/consultar sua API Key...
  start "" "https://aistudio.google.com/app/apikey"
  echo.
  echo Quando tiver a chave, execute este arquivo novamente.
  pause
  exit /b 0
)

where npm.cmd >nul 2>&1 || goto :node_error
where npx.cmd >nul 2>&1 || goto :node_error
where powershell.exe >nul 2>&1 || goto :powershell_error

pushd backend
call npm.cmd install
if errorlevel 1 goto :error_pop
call npx.cmd wrangler whoami >nul 2>&1
if errorlevel 1 (
  call npx.cmd wrangler login
  if errorlevel 1 goto :error_pop
)

echo.
echo [1/4] Publicando primeiro o codigo 3.3.4...
call npx.cmd wrangler deploy
if errorlevel 1 goto :error_pop

echo.
echo [2/4] Gravando GEMINI_API_KEY como Secret...
echo Cole a chave somente no prompt seguro do Wrangler:
call npx.cmd wrangler secret put GEMINI_API_KEY
if errorlevel 1 goto :error_pop

echo.
echo [3/4] Conferindo se o Secret existe no Worker...
set "SECRETLIST=%TEMP%\marshmallow-secrets-%RANDOM%-%RANDOM%.json"
call npx.cmd wrangler secret list --format json > "%SECRETLIST%"
if errorlevel 1 (
  del /q "%SECRETLIST%" >nul 2>&1
  goto :error_pop
)
findstr /I /C:"GEMINI_API_KEY" "%SECRETLIST%" >nul
if errorlevel 1 (
  echo [ERRO] O Wrangler nao encontrou GEMINI_API_KEY na lista remota de Secrets.
  type "%SECRETLIST%"
  del /q "%SECRETLIST%" >nul 2>&1
  goto :error_pop
)
del /q "%SECRETLIST%" >nul 2>&1
echo [OK] GEMINI_API_KEY consta na lista remota de Secrets.

echo.
echo IMPORTANTE: nao havera um segundo deploy aqui.
echo "wrangler secret put" ja publicou a versao contendo o Secret.
popd

echo.
echo [4/4] Aguardando propagacao e validando Gemini...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-backend-3.3.4.ps1" -BaseUrl "%MMURL%" -RequireGemini -WaitSeconds 90
if errorlevel 1 goto :error

echo.
echo [OK] Gemini esta ativo como provedor principal do MarshMallow AI.
echo [OK] Workers AI permanece como fallback automatico.
echo.
pause
exit /b 0

:error_pop
popd 2>nul
:error
echo.
echo ERRO: nao foi possivel ativar/validar Gemini.
echo Nao envie sua API Key pelo chat.
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
