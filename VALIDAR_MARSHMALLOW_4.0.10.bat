@echo off
cd /d "%~dp0"
echo Validando MarshMallow 4.0.10...
node --check electron\main.mjs || goto :erro
node --check electron\preload.cjs || goto :erro
node --check electron\omnibox-preload.cjs || goto :erro
node --check scripts\dev.mjs || goto :erro
call npm run typecheck || goto :erro
echo.
echo OK - validacao concluida.
pause
exit /b 0
:erro
echo.
echo ERRO na validacao.
pause
exit /b 1
