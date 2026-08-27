@echo off
setlocal
cd /d "%~dp0"
title Validar MarshMallow 3.1.1

echo Validando arquivos essenciais...
for %%F in (package.json index.html vite.config.ts src\App.tsx src\styles.css electron\main.mjs electron\preload.cjs backend\src\index.js backend\wrangler.jsonc build\icon.ico public\icon.png PUBLICAR_BACKEND_3.1.1.bat) do (
  if not exist "%%F" (
    echo [ERRO] %%F nao encontrado.
    pause
    exit /b 1
  )
)

echo [OK] Arquivos essenciais presentes.
echo.
echo Conferindo sintaxe do backend Electron/Worker...
node --check electron\main.mjs
if errorlevel 1 goto :erro
node --check backend\src\index.js
if errorlevel 1 goto :erro

echo.
echo Instalando dependencias e executando typecheck...
call npm.cmd install
if errorlevel 1 goto :erro
call npm.cmd run typecheck
if errorlevel 1 goto :erro
call npm.cmd run build:web
if errorlevel 1 goto :erro

echo.
echo [OK] MarshMallow 3.1.1 validado.
pause
exit /b 0
:erro
echo.
echo [ERRO] A validacao falhou. Envie a mensagem acima ao ChatGPT.
pause
exit /b 1
