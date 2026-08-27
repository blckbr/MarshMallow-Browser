@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MarshMallow 3.3.5 - Publicar Identidade Oficial
set "MMURL=https://marshmallow-gateway.marshmallow-browser-br.workers.dev"

echo.
echo ==============================================================
echo   MARSHMALLOW 3.3.5 - AUTORIA OFICIAL
echo ==============================================================
echo.
echo Esta atualizacao grava a autoria oficial no backend da IA:
echo   Criador e desenvolvedor: Deivison Santos (@devsaex)
echo.
echo O Secret GEMINI_API_KEY existente nao precisa ser digitado novamente.
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

echo [1/2] Publicando backend 3.3.5...
call npx.cmd wrangler deploy
if errorlevel 1 goto :error_pop
popd

echo.
echo [2/2] Validando versao, IA e autoria...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\validate-backend-3.3.5.ps1" -BaseUrl "%MMURL%" -WaitSeconds 90
if errorlevel 1 goto :error

echo.
echo [OK] MarshMallow 3.3.5 publicado.
echo [OK] Autoria oficial: Deivison Santos (@devsaex)
echo.
pause
exit /b 0

:error_pop
popd 2>nul
:error
echo.
echo ERRO: publicacao/validacao nao concluida.
echo O navegador local ainda pode ser aberto, mas a IA online precisa deste deploy.
pause
exit /b 1
