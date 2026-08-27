@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 5.0.0 - SEO Google - Republicar somente o site

echo ==============================================================
echo  MARSHMALLOW 5.0.0 - SEO GOOGLE GRATUITO
echo ==============================================================
echo.
echo Esta operacao:
echo   - NAO recompila o navegador
echo   - NAO faz git push
echo   - NAO cria nem altera GitHub Release
echo   - NAO reenvia o instalador de 110 MB
echo   - publica SOMENTE o site no Cloudflare Pages
echo   - testa SEO antes do deploy e confirma as URLs depois
echo.
set /p CONFIRM=Digite SEO para continuar: 
if /I not "%CONFIRM%"=="SEO" (
  echo.
  echo Operacao cancelada.
  pause
  exit /b 1
)

echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows-republish-site-seo-5.0.ps1" -Root "%~dp0"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [SUCESSO] Site SEO publicado e validado.
  echo Agora siga GUIA_GOOGLE_SEARCH_CONSOLE.md.
) else (
  echo [FALHA] Consulte REPUBLICACAO_SITE_SEO_5.0.0.log.
)
pause
exit /b %RC%
