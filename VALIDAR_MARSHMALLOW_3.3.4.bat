@echo off
setlocal
cd /d "%~dp0"
set FAIL=0
findstr /C:"\"version\": \"3.3.4\"" package.json >nul || set FAIL=1
findstr /C:"version: \"3.3.4\"" src\App.tsx >nul || set FAIL=1
findstr /C:"backendVersion: \"3.3.4\"" backend\src\index.js >nul || set FAIL=1
findstr /C:"wrangler secret list --format json" ATIVAR_GEMINI_3.3.4.bat >nul || set FAIL=1
findstr /C:"nao havera um segundo deploy" ATIVAR_GEMINI_3.3.4.bat >nul || set FAIL=1
if "%FAIL%"=="0" (
  echo [OK] MarshMallow 3.3.4 validado.
  exit /b 0
)
echo [ERRO] Validacao 3.3.4 falhou.
exit /b 1
