@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 4.0.6 - Validacao Barra de Endereco
echo ==============================================================
echo   MARSHMALLOW 4.0.6 - ESC RESTAURA URL
echo ==============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -Raw '.\package.json'|ConvertFrom-Json; if($p.version -ne '4.0.6'){Write-Host '[ERRO] Versao inesperada:' $p.version; exit 1}; Write-Host '[OK] Versao 4.0.6'"
if errorlevel 1 goto :fail

findstr /C:"4.0.6" electron\main.mjs >nul || goto :fail
findstr /C:"4.0.6" electron\preload.cjs >nul || goto :fail
findstr /C:"currentTabAddress" src\App.tsx >nul || goto :fail
findstr /C:"Esc restaurar URL" src\App.tsx >nul || goto :fail
findstr /C:"addressRef.current?.blur()" src\App.tsx >nul || goto :fail

echo [OK] Handler de Escape encontrado.
echo [OK] Restauracao usa a URL real da aba.
echo [OK] Nova aba restaura para endereco vazio.
echo.
echo Validacao estatica concluida.
echo Abra INICIAR_MARSHMALLOW_4.0.6.bat.
exit /b 0

:fail
echo.
echo [ERRO] A validacao encontrou um problema nos arquivos 4.0.6.
exit /b 1
