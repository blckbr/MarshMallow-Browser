@echo off
cd /d "%~dp0"
call ALTERAR_LINK_PARA_MARSHMALLOW_API.bat
exit /b %ERRORLEVEL%
