@echo off
cd /d "%~dp0"
echo.
echo MarshMallow 4.0.8 - Teste dos controles da aba
echo.
echo 1. Abra um video no YouTube e inicie a reproducao.
echo 2. Observe a aba vertical correspondente.
echo 3. O X deve ficar no canto SUPERIOR direito.
echo 4. O controle de audio/mudo deve ficar no canto INFERIOR direito.
echo 5. Clique varias vezes em mutar/desmutar e confirme que nao fecha a aba.
echo.
pause
call INICIAR_MARSHMALLOW_ELECTRON.bat
