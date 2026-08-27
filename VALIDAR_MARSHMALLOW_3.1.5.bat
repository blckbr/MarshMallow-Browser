@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MarshMallow 3.1.5 - Validacao

echo Verificando arquivos principais...
for %%F in (
  "ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1"
  "ALTERAR_LINK_PARA_MARSHMALLOW.bat"
  "backend\wrangler.jsonc"
  "backend\src\index.js"
  "electron\main.mjs"
  "src\App.tsx"
  "build\icon.ico"
) do (
  if not exist "%%~F" (
    echo [ERRO] Ausente: %%~F
    pause
    exit /b 1
  )
)

echo Conferindo fluxo seguro do workers.dev...
findstr /c:"Invoke-CfApi -Method \"DELETE\"" "ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1" >nul || goto :fail
findstr /c:"Restore-OldSubdomain" "ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1" >nul || goto :fail
findstr /c:"New-AccountSubdomain" "ALTERAR_LINK_PARA_MARSHMALLOW_API.ps1" >nul || goto :fail
findstr /c:"workers_dev" "backend\wrangler.jsonc" >nul || goto :fail

echo [OK] Estrutura 3.1.5 validada.
exit /b 0

:fail
echo [ERRO] A validacao do fluxo de migracao falhou.
pause
exit /b 1
