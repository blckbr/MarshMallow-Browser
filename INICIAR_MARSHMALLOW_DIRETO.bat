@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 4.0.7 Electron - Inicio Direto

echo.
echo ============================================
echo   MarshMallow 4.0.7 - Inicio Direto
echo ============================================
echo.

if not exist "package.json" (
  echo ERRO: package.json nao encontrado em:
  echo %CD%
  pause
  exit /b 1
)

set NEED_INSTALL=0
if not exist "node_modules\electron\package.json" set NEED_INSTALL=1
if not exist "node_modules\qrcode\package.json" set NEED_INSTALL=1
if not exist "node_modules\vite\package.json" set NEED_INSTALL=1

if "%NEED_INSTALL%"=="1" (
  echo Instalando/atualizando dependencias...
  call npm install
  if errorlevel 1 goto :erro
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Preparando o motor Electron pela primeira vez...
  if not exist "node_modules\electron\install.js" (
    call npm install electron@43.4.1 --save-dev
    if errorlevel 1 goto :erro
  )
  node "node_modules\electron\install.js" --no
  if errorlevel 1 goto :erro
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo ERRO: electron.exe nao foi encontrado apos a preparacao.
  pause
  exit /b 1
)

echo Iniciando Vite...
start "MarshMallow Vite" /min cmd /d /s /c "cd /d ""%CD%"" && npm run dev:web"

echo Aguardando servidor local...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$deadline=(Get-Date).AddSeconds(60); do { try { $r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:1421' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0} } catch {}; Start-Sleep -Milliseconds 350 } while((Get-Date) -lt $deadline); exit 1"

if errorlevel 1 (
  echo ERRO: Vite nao respondeu na porta 1421.
  pause
  exit /b 1
)

echo Abrindo Electron...
set "MARSHMALLOW_DEV_URL=http://127.0.0.1:1421"
"node_modules\electron\dist\electron.exe" .
exit /b 0

:erro
echo.
echo Falha ao instalar/iniciar.
pause
exit /b 1
