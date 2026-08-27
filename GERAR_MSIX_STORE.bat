@echo off
setlocal
cd /d "%~dp0"
title MarshMallow Browser - Gerador MSIX Microsoft Store

echo ==============================================================
echo  MARSHMALLOW BROWSER 5.0.0 - GERADOR MSIX MICROSOFT STORE
echo  Criador/Desenvolvedor: Deivison Santos / @devsaex
echo ==============================================================
echo.
echo Este processo NAO envia para certificacao.
echo Ele gera e valida o .MSIX para voce fazer upload no Partner Center.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-msix.ps1"
set RC=%ERRORLEVEL%

echo.
if not "%RC%"=="0" (
  echo [ERRO] O MSIX nao foi liberado. Leia a mensagem acima.
  pause
  exit /b %RC%
)

echo [OK] Processo concluido.
pause
exit /b 0
