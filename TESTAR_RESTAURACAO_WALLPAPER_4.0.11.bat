@echo off
cd /d "%~dp0"
cls
echo ============================================================
echo   MarshMallow 4.0.11 - Restauracao de abas e wallpapers
echo ============================================================
echo.
echo TESTE 1 - ABAS
 echo 1. Abra 3 ou mais paginas comuns.
echo 2. Va a Configuracoes ^> Inicializacao.
echo 3. Ative "Manter as abas abertas para usa-las apos reiniciar".
echo 4. Feche o MarshMallow normalmente.
echo 5. Abra novamente e confirme que as abas voltaram.
echo.
echo TESTE 2 - WALLPAPER
 echo 1. Abra uma nova aba.
echo 2. Se nao houver wallpaper, escolha uma das imagens sugeridas.
echo 3. Clique em "Escolher outro wallpaper" no canto inferior direito.
echo 4. Troque a imagem.
echo 5. Clique novamente e use "Remover wallpaper".
echo 6. Confirme que as sugestoes reaparecem.
echo.
pause
call INICIAR_MARSHMALLOW_ELECTRON.bat
