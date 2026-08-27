@echo off
setlocal
cd /d "%~dp0"
title MarshMallow 3.2.3 - Reparar Contas

echo.
echo ==============================================================
echo   MARSHMALLOW 3.2.3 - REPARAR CONTAS / PBKDF2
echo ==============================================================
echo.
echo O erro encontrado foi identificado com precisao:
echo a versao 3.2.2 solicitava 120000 iteracoes PBKDF2, mas o runtime
echo Cloudflare usado pelo Worker aceita no maximo 100000.
echo.
echo Esta revisao usa 100000 iteracoes e valida o mesmo fluxo antes de iniciar.
echo.
echo IMPORTANTE: esta etapa e somente para o proprietario do projeto.
echo Usuarios que receberem o instalador nao precisam executar isto.
echo.
pause
call "%~dp0PUBLICAR_BACKEND_3.2.3.bat"
if errorlevel 1 exit /b 1

echo.
echo Iniciando MarshMallow...
call "%~dp0INICIAR_MARSHMALLOW_ELECTRON.bat"
