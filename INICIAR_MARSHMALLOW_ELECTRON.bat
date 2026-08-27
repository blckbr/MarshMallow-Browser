@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 4.1.0 Electron

echo.
echo ============================================
echo   MarshMallow 4.1.0 - Electron
echo ============================================
echo.

if not exist "package.json" (
  echo ERRO: package.json nao encontrado em:
  echo %CD%
  echo.
  pause
  exit /b 1
)

echo Verificando processos antigos desta copia do MarshMallow...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\cleanup-dev.ps1" -ProjectRoot "%~dp0"
echo.

set NEED_INSTALL=0
if not exist "node_modules\electron\package.json" set NEED_INSTALL=1
if not exist "node_modules\qrcode\package.json" set NEED_INSTALL=1
if not exist "node_modules\vite\package.json" set NEED_INSTALL=1

if "%NEED_INSTALL%"=="1" (
  echo Instalando/atualizando dependencias...
  call npm install
  if errorlevel 1 (
    echo.
    echo ERRO: npm install falhou.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo Preparando o motor Electron pela primeira vez...
  echo Isso acontece uma vez e pode levar alguns minutos.
  echo.

  if not exist "node_modules\electron\install.js" (
    echo ERRO: o pacote Electron esta incompleto.
    echo Tentando reparar com npm install...
    call npm install electron@43.4.1 --save-dev
    if errorlevel 1 (
      echo.
      echo ERRO: nao foi possivel reparar o pacote Electron.
      pause
      exit /b 1
    )
  )

  node "node_modules\electron\install.js" --no
  if errorlevel 1 (
    echo.
    echo ERRO: o download do motor Electron falhou.
    echo Verifique a conexao com a internet e execute este arquivo novamente.
    pause
    exit /b 1
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo.
  echo ERRO: Electron terminou a instalacao, mas electron.exe ainda nao existe em:
  echo %CD%\node_modules\electron\dist\electron.exe
  echo.
  pause
  exit /b 1
)

echo Iniciando MarshMallow...
call npm run electron:dev

if errorlevel 1 (
  echo.
  echo O MarshMallow encontrou um erro ao iniciar.
  echo Copie o texto desta janela e envie no chat.
  pause
  exit /b 1
)
