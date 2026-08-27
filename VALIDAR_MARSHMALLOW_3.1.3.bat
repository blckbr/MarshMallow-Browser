@echo off
setlocal
cd /d "%~dp0"
title Validar MarshMallow 3.1.3

echo Validando arquivos principais...
for %%F in ("src\App.tsx" "electron\main.mjs" "electron\preload.cjs" "backend\src\index.js" "backend\wrangler.jsonc" "build\icon.ico" "ALTERAR_LINK_PARA_MARSHMALLOW.bat" "ALTERAR_LINK_PARA_MARSHMALLOW_API.bat" "ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1") do (
  if not exist %%F (
    echo [ERRO] Ausente: %%F
    exit /b 1
  ) else (
    echo [OK] %%F
  )
)

echo.
echo Conferindo endereco de marca...
findstr /i /c:".marshmallow.workers.dev" src\App.tsx >nul || (echo [ERRO] App nao contem o endereco de marca. & exit /b 1)
findstr /i /c:".marshmallow.workers.dev" .env.example >nul || (echo [ERRO] .env.example nao contem o endereco de marca. & exit /b 1)
findstr /i /c:"/workers/subdomain" ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1 >nul || (echo [ERRO] Assistente nao usa a API de subdominio da Cloudflare. & exit /b 1)
findstr /i /c:"Workers Scripts - Edit" ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1 >nul || (echo [ERRO] Instrucao de permissao do token ausente. & exit /b 1)
echo [OK] Assistente de marca configurado.

echo.
echo Conferindo sintaxe JavaScript...
node --check electron\main.mjs || exit /b 1
node --check electron\preload.cjs || exit /b 1
node --check backend\src\index.js || exit /b 1

echo.
echo Conferindo versao 3.1.3...
findstr /c:"3.1.3" package.json >nul || (echo [ERRO] package.json nao esta em 3.1.3. & exit /b 1)
findstr /c:"3.1.3" electron\main.mjs >nul || (echo [ERRO] Electron nao esta em 3.1.3. & exit /b 1)
findstr /c:"3.1.3" src\App.tsx >nul || (echo [ERRO] App nao esta em 3.1.3. & exit /b 1)

echo.
echo [OK] Validacao estatica concluida.
pause
