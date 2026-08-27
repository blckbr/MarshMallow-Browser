@echo off
cd /d "%~dp0"
cls
echo ==============================================================
echo   MarshMallow 4.0.12 - Wallpapers premium + restauracao
 echo ==============================================================
echo.
echo TESTE 1 - NOVA ABA E WALLPAPERS
 echo 1. Abra uma nova aba. Sem wallpaper, ela deve ficar limpa.
echo 2. O convite de personalizacao deve ser discreto no canto inferior.
echo 3. Clique em Personalizar e teste Fotografico e MarshMallow Studio.
echo 4. Ative Surpreenda-me e abra 3 novas abas: as imagens devem variar.
echo 5. Ative Imagem do dia: novas abas do mesmo dia devem manter a imagem.
echo 6. Escolha uma imagem fixa e depois uma imagem do seu computador.
echo.
echo TESTE 2 - RESTAURACAO DE ABAS
 echo 1. Abra 3 ou mais sites comuns.
echo 2. Va a Configuracoes ^> Inicializacao.
echo 3. Ative "Manter as abas abertas para usa-las apos reiniciar".
echo 4. Feche o MarshMallow normalmente e abra novamente.
echo 5. As abas normais devem voltar. Abas privadas nao devem voltar.
echo.
echo Observacao: a colecao Fotografico e online; a colecao Studio funciona offline.
echo.
pause
call INICIAR_MARSHMALLOW_ELECTRON.bat
