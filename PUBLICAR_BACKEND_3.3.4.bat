@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MarshMallow 3.3.4 - Publicar Backend
set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"

echo.
echo ==============================================================
echo   MARSHMALLOW 3.3.4 - BACKEND / IA
echo ==============================================================
echo.
echo Esta revisao corrige a ativacao do Secret GEMINI_API_KEY.
echo Gemini continua opcional: sem a chave, Workers AI funciona normalmente.
echo.

where npm.cmd >nul 2>&1 || goto :error
where npx.cmd >nul 2>&1 || goto :error
where powershell.exe >nul 2>&1 || goto :error

pushd backend
call npm.cmd install
if errorlevel 1 goto :error_pop
call npx.cmd wrangler whoami >nul 2>&1
if errorlevel 1 (
  call npx.cmd wrangler login
  if errorlevel 1 goto :error_pop
)
call npx.cmd wrangler deploy
if errorlevel 1 goto :error_pop
popd

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-backend-3.3.4.ps1" -BaseUrl "%MMURL%" -WaitSeconds 60
if errorlevel 1 goto :error

echo.
echo [OK] Backend 3.3.4 publicado.
echo Para usar Gemini como principal, execute ATIVAR_GEMINI_3.3.4.bat.
pause
exit /b 0

:error_pop
popd 2>nul
:error
echo.
echo ERRO: publicacao/validacao nao concluida.
pause
exit /b 1
