@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\self-test.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERRO] O autoteste falhou.
) else (
  echo [OK] Correcao do Registro validada.
)
pause
exit /b %RC%
