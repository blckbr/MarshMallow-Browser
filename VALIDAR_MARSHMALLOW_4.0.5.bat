@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.5 - Validacao Nova Aba + Wallpaper

echo ==============================================================
echo   MARSHMALLOW 4.0.5 - NOVA ABA + WALLPAPER
echo ==============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -Raw '.\package.json'|ConvertFrom-Json; if($p.version -ne '4.0.5'){Write-Host '[ERRO] Versao inesperada:' $p.version; exit 1}; Write-Host '[OK] Versao 4.0.5'"
if errorlevel 1 goto :erro

findstr /c:"marshmallow://newtab" "electron\main.mjs" >nul || goto :erro
findstr /c:"NewTabPage" "src\App.tsx" >nul || goto :erro
findstr /c:"Escolher wallpaper" "src\App.tsx" >nul || goto :erro
findstr /c:"newtab-wallpaper" "src\styles.css" >nul || goto :erro
echo [OK] Nova aba interna e wallpaper presentes.

findstr /c:"LEGACY_DEFAULT_HOME_URL" "electron\main.mjs" >nul || goto :erro
echo [OK] Migracao do antigo Google como pagina padrao presente.

node --check "electron\main.mjs"
if errorlevel 1 goto :erro
node --check "electron\preload.cjs"
if errorlevel 1 goto :erro
echo [OK] Sintaxe Electron validada.

echo.
echo [OK] Validacao local concluida.
echo Abra INICIAR_MARSHMALLOW_4.0.5.bat.
echo Nova aba sem wallpaper: deve mostrar somente o fundo limpo e o convite discreto.
echo Depois escolha um wallpaper: novas abas devem exibi-lo automaticamente.
pause
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema nos arquivos 4.0.5.
pause
exit /b 1
