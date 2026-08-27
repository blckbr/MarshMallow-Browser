@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.3.0 - Validacao

echo ==============================================================
echo   MARSHMALLOW 3.3.0 - VALIDACAO RAPIDA
echo ==============================================================
echo.

where node >nul 2>nul || (
  echo [ERRO] Node.js nao foi encontrado no PATH.
  pause
  exit /b 1
)

node --check electron\main.mjs || goto :erro
node --check electron\preload.cjs || goto :erro
node --check backend\src\index.js || goto :erro
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('[OK] package.json')" || goto :erro

echo [OK] JavaScript e package.json sem erro de sintaxe.
echo.
echo Para validar TypeScript e gerar o front-end, execute:
echo   npm install
echo   npm run build:web
echo.
echo [OK] Validacao rapida concluida.
pause
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema.
pause
exit /b 1
