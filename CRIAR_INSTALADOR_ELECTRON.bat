@echo off
setlocal
cd /d "%~dp0"
call "%~dp0CRIAR_INSTALADOR_4.1.0.bat"
exit /b %ERRORLEVEL%
