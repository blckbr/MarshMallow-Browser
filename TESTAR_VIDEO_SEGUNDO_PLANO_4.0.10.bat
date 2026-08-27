@echo off
cd /d "%~dp0"
echo.
echo MarshMallow 4.0.10 - Teste de video em nova aba de segundo plano
echo.
echo Esta versao primeiro encerra SOMENTE processos antigos de desenvolvimento
echo desta copia do MarshMallow. Cookies, historico e perfil nao sao apagados.
echo.
echo 1. Abra o YouTube em uma aba.
echo 2. Abra um video em nova aba de segundo plano.
echo 3. NAO clique na nova aba ainda.
echo 4. Confirme que a pagina carrega, mas o video nao toca nem avanca.
echo 5. Clique na nova aba; a reproducao deve ser liberada.
echo.
pause
call INICIAR_MARSHMALLOW_ELECTRON.bat
