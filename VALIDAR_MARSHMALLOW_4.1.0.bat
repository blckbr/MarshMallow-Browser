@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.1.0 - Validação de release

echo ==============================================================
echo   MARSHMALLOW 4.1.0 - VALIDACAO DE RELEASE
echo ==============================================================
echo.

where node >nul 2>nul || goto :semnode
where npm >nul 2>nul || goto :semnode

findstr /C:"4.1.0" package.json >nul || goto :fail
findstr /C:"Deivison Santos" MARSHMALLOW_CREATOR.txt >nul || goto :fail
findstr /C:"@devsaex" MARSHMALLOW_CREATOR.txt >nul || goto :fail
findstr /C:"marshmallow://extensions" electron\main.mjs >nul || goto :fail
findstr /C:"browser:list-media" electron\main.mjs >nul || goto :fail
findstr /C:"setDisplayMediaRequestHandler(null)" electron\main.mjs >nul || goto :fail

echo [1/5] Sintaxe Electron/Node...
node --check electron\main.mjs || goto :fail
node --check electron\preload.cjs || goto :fail
node --check electron\chat-bubble-preload.cjs || goto :fail
node --check electron\omnibox-preload.cjs || goto :fail
node --check electron\watch-preload.cjs || goto :fail
node --check scripts\dev.mjs || goto :fail
node --check backend\src\index.js || goto :fail

echo [2/5] Dependencias...
set NEED_INSTALL=0
if not exist "node_modules\typescript\package.json" set NEED_INSTALL=1
if not exist "node_modules\react\package.json" set NEED_INSTALL=1
if not exist "node_modules\vite\package.json" set NEED_INSTALL=1
if not exist "node_modules\electron\package.json" set NEED_INSTALL=1
if not exist "node_modules\qrcode\package.json" set NEED_INSTALL=1
if "%NEED_INSTALL%"=="1" (
  call npm install --no-audit --no-fund || goto :fail
)

echo [3/5] TypeScript...
call npm run typecheck || goto :fail

echo [4/5] Build do renderer...
call npm run build:web || goto :fail

echo [5/5] Arquivos essenciais...
if not exist "dist\index.html" goto :fail
if not exist "build\icon.ico" goto :fail

echo.
echo [OK] Validacao concluida sem erros.
exit /b 0

:semnode
echo [ERRO] Node.js/npm nao foi encontrado no PATH.
exit /b 1

:fail
echo.
echo [ERRO] A validacao falhou. Nao publique esta copia ainda.
exit /b 1
