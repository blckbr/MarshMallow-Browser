@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.4 - Teste Autopreenchimento

echo ==============================================================
echo   MARSHMALLOW 4.0.4 - TESTE RAPIDO
echo ==============================================================
echo.
echo 1. Abra Google e Gmail pelo menos uma vez.
echo 2. Volte a barra de endereco e digite: go
echo    O Google deve aparecer entre as primeiras sugestoes.
echo 3. Digite: gm
echo    O Gmail deve aparecer entre as primeiras sugestoes.
echo 4. Use setas para escolher, TAB para preencher e ENTER para abrir.
echo 5. Em qualquer caixa de texto, escreva uma palavra errada.
echo    Clique com botao direito sobre ela para ver sugestoes ortograficas.
echo.
pause
call "%~dp0INICIAR_MARSHMALLOW_4.0.4.bat"
