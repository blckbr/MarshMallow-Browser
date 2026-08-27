@echo off
setlocal
cd /d "%~dp0"
title Validar MarshMallow 3.1.2

echo Validando arquivos principais...
for %%F in ("src\App.tsx" "electron\main.mjs" "electron\preload.cjs" "backend\src\index.js" "backend\wrangler.jsonc" "build\icon.ico" "ALTERAR_LINK_PARA_MARSHMALLOW.bat") do (
  if not exist %%F (
    echo [ERRO] Ausente: %%F
    exit /b 1
  ) else (
    echo [OK] %%F
  )
)

echo.
echo Conferindo backend padrao de marca...
findstr /i /c:".marshmallow.workers.dev" src\App.tsx >nul || (echo [ERRO] App nao aponta para o subdominio MarshMallow. & exit /b 1)
findstr /i /c:".marshmallow.workers.dev" .env.example >nul || (echo [ERRO] .env.example nao aponta para o subdominio MarshMallow. & exit /b 1)
echo [OK] Backend padrao usa a marca MarshMallow.

echo.
echo Conferindo sintaxe JavaScript do processo Electron e Worker...
node --check electron\main.mjs || exit /b 1
node --check electron\preload.cjs || exit /b 1
node --check backend\src\index.js || exit /b 1

echo.
echo [OK] Validacao estatica concluida.
pause
