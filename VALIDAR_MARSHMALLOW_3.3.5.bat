@echo off
setlocal
cd /d "%~dp0"
echo Validando MarshMallow 3.3.5...
set FAIL=0
if not exist MARSHMALLOW_CREATOR.txt (echo [ERRO] MARSHMALLOW_CREATOR.txt ausente& set FAIL=1)
findstr /C:"Deivison Santos" MARSHMALLOW_CREATOR.txt >nul || (echo [ERRO] Nome oficial ausente& set FAIL=1)
findstr /C:"@devsaex" MARSHMALLOW_CREATOR.txt >nul || (echo [ERRO] Handle oficial ausente& set FAIL=1)
findstr /C:"Deivison Santos" backend\src\index.js >nul || (echo [ERRO] Backend sem autoria& set FAIL=1)
findstr /C:"Deivison Santos" src\App.tsx >nul || (echo [ERRO] Sobre sem autoria& set FAIL=1)
findstr /C:"MARSHMALLOW_CREATOR.txt" package.json >nul || (echo [ERRO] Arquivo de autoria nao sera instalado na raiz& set FAIL=1)
if "%FAIL%"=="1" exit /b 1
echo [OK] Autoria oficial fixa: Deivison Santos (@devsaex)
echo [OK] Arquivo de autoria incluido na raiz do instalador.
exit /b 0
