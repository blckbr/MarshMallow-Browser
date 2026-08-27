@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MarshMallow 3.1.9 - Reparar Cadastro

echo.
echo ==============================================================
echo   MARSHMALLOW 3.1.9 - REPARAR CADASTRO / LOGIN
echo ==============================================================
echo.
echo Este assistente publica o backend 3.1.9, valida o AccountStore
echo e depois inicia o MarshMallow.
echo.

echo IMPORTANTE: esta etapa e somente para o proprietario do projeto.
echo Usuarios que receberem o instalador nao precisam executar isto.
echo.
pause

call "%~dp0PUBLICAR_BACKEND_3.1.9.bat"
if errorlevel 1 (
  echo.
  echo [ERRO] O backend nao passou na validacao.
  echo Envie o texto desta janela no chat, mas nao envie tokens ou segredos.
  pause
  exit /b 1
)

echo.
echo [OK] Backend de contas validado.
echo Iniciando o MarshMallow...
echo.
call "%~dp0INICIAR_MARSHMALLOW_ELECTRON.bat"
exit /b %errorlevel%
