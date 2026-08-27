@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.3 - Validacao Login e Cookies

echo ==============================================================
echo   MARSHMALLOW 4.0.3 - VALIDACAO LOGIN + COOKIES
echo ==============================================================
echo.

if not exist package.json (
  echo [ERRO] package.json nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -Raw '.\package.json'|ConvertFrom-Json; if($p.version -ne '4.0.3'){Write-Host '[ERRO] Versao inesperada:' $p.version; exit 1}; Write-Host '[OK] Versao 4.0.3'"
if errorlevel 1 goto :erro

findstr /c:"persist:marshmallow" "electron\main.mjs" >nul || goto :erro
echo [OK] Perfil Chromium persistente presente.

findstr /c:"storage-access" "electron\main.mjs" >nul || goto :erro
findstr /c:"top-level-storage-access" "electron\main.mjs" >nul || goto :erro
echo [OK] Storage Access para logins modernos presente.

findstr /c:"browser:list-cookies" "electron\main.mjs" >nul || goto :erro
findstr /c:"browser:export-cookies" "electron\main.mjs" >nul || goto :erro
findstr /c:"aes-256-gcm" "electron\main.mjs" >nul || goto :erro
echo [OK] Gerenciador e backup criptografado de cookies presentes.

node --check "electron\main.mjs"
if errorlevel 1 goto :erro
node --check "electron\preload.cjs"
if errorlevel 1 goto :erro
echo [OK] Sintaxe Electron validada.

echo.
echo [OK] Validacao local concluida.
echo Agora execute INICIAR_MARSHMALLOW_4.0.3.bat.
echo Teste: YouTube ^> Fazer login ^> fechar o MarshMallow ^> abrir novamente.
echo Depois confira Configuracoes ^> Cookies e dados.
pause
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema nos arquivos 4.0.3.
pause
exit /b 1
