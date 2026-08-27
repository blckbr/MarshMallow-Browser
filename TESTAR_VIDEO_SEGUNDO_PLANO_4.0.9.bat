@echo off
cd /d "%~dp0"
echo.
echo MarshMallow 4.0.9 - Teste de video em nova aba de segundo plano
echo.
echo 1. Abra o YouTube em uma aba.
echo 2. Clique com o botao direito em um video e escolha abrir em nova aba,
echo    ou use o gesto que abre o link em segundo plano.
echo 3. NAO clique na nova aba ainda.
echo 4. Confirme que a pagina carrega, mas o video nao toca e nao avanca.
echo 5. Clique na nova aba.
echo 6. A partir desse momento a reproducao fica liberada normalmente.
echo 7. Volte para outra aba: depois da primeira abertura, o video nao deve ser
echo    pausado automaticamente pelo MarshMallow.
echo.
pause
call INICIAR_MARSHMALLOW_ELECTRON.bat
