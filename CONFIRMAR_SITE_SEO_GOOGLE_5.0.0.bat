@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 5.0.0 - Confirmar SEO publicado

echo ==============================================================
echo  MARSHMALLOW 5.0.0 - CONFIRMAR SEO PUBLICADO
echo ==============================================================
echo.
echo Esta operacao NAO faz deploy, NAO recompila, NAO altera GitHub
echo e NAO envia o instalador. Ela apenas confere o site publico.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-confirm-site-seo-5.0.ps1" -Root "%~dp0"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [SUCESSO] O SEO publicado foi confirmado.
) else (
  echo [FALHA] Consulte CONFIRMACAO_SITE_SEO_5.0.0.log.
)
pause
exit /b %RC%
