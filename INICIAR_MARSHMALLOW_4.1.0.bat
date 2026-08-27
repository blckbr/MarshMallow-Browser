@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.1.0
call "%~dp0INICIAR_MARSHMALLOW_ELECTRON.bat"
