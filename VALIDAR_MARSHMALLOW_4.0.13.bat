@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo   MarshMallow 4.0.13 - Validacao
echo ============================================
echo.
node --check electron\main.mjs || goto :fail
node --check electron\preload.cjs || goto :fail
call npm run typecheck || goto :fail
echo.
echo Validacao concluida sem erros.
pause
exit /b 0
:fail
echo.
echo A validacao encontrou um erro. Nao crie o instalador ainda.
pause
exit /b 1
