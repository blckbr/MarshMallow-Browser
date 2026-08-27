@echo off
setlocal
chcp 65001 >nul
title MarshMallow 5.0.1 - Validar e compilar

for %%I in ("%~dp0.") do set "ROOT=%%~fI"
set "PS1=%~dp0scripts\windows-build-5.0.1.ps1"
if exist "%PS1%" goto :helper_found
set "PS1=%~dp0windows-build-5.0.1.ps1"
if exist "%PS1%" (
  for %%I in ("%~dp0..") do set "ROOT=%%~fI"
  goto :helper_found
)

echo [PACOTE_5_COMPLETO] O script windows-build-5.0.1.ps1 nao foi encontrado.
echo Extraia o pacote completo MarshMallow 5.0.1 e execute este BAT sem separar os arquivos.
echo Nao coloque este BAT sozinho dentro da pasta scripts da versao 4.1.0.
pause
exit /b 2

:helper_found
cd /d "%ROOT%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Root "%ROOT%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [FALHA] A compilacao/validacao nao passou. Nada foi publicado.
) else (
  echo [OK] Build 5.0.1 criado e validado automaticamente.
  echo Agora execute REGISTRAR_SMOKE_5.0.1.bat e teste o navegador no Windows.
)
pause
exit /b %RC%
