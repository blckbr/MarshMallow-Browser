@echo off
setlocal EnableExtensions
chcp 65001 >nul

title MarshMallow 5.0.0 - PDF Reader FIX5

echo ==============================================================
echo  MARSHMALLOW 5.0.0 - INSTALAR PDF READER FIX5
echo ==============================================================
echo.
echo Esta revisao remove o editor PDF e mantem somente o leitor.
echo O processo cria backup, aplica o modulo e valida o projeto.
echo Se uma validacao falhar, o codigo-fonte anterior sera restaurado.
echo.

set "ZIP=%~dp0MarshMallow-5.0.0-PDF-Reader-FIX5.zip"
if not exist "%ZIP%" (
  echo [ERRO] Nao encontrei:
  echo %ZIP%
  echo.
  echo Deixe este BAT e o ZIP FIX5 na mesma pasta.
  pause
  exit /b 1
)

set "TARGET=C:\MarshMallow-5.0.0-Source"
if exist "%~dp0package.json" set "TARGET=%~dp0"
if not exist "%TARGET%\package.json" (
  echo [ERRO] Projeto nao encontrado em:
  echo %TARGET%
  echo.
  echo Coloque o BAT dentro do projeto ou use C:\MarshMallow-5.0.0-Source.
  pause
  exit /b 1
)

set "TMP=%TEMP%\MarshMallow-PDF-Reader-%RANDOM%-%RANDOM%"
mkdir "%TMP%" >nul 2>nul

echo [INFO] Projeto: %TARGET%
echo [INFO] Pacote : %ZIP%
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%TMP%' -Force; & '%TMP%\scripts\install-pdf-reader.ps1' -SourceRoot '%TMP%' -TargetRoot '%TARGET%'; exit $LASTEXITCODE"
set "RC=%ERRORLEVEL%"

rmdir /s /q "%TMP%" >nul 2>nul

echo.
if "%RC%"=="0" (
  echo [OK] PDF Reader aplicado e validado.
  echo.
  echo Agora execute npm run dev e faca o smoke test manual.
) else (
  echo [FALHA] O PDF Reader nao foi liberado.
  echo O instalador tentou restaurar o backup.
)
echo.
echo Codigo de saida: %RC%
pause
exit /b %RC%
