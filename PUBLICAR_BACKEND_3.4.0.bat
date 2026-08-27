@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow Backend 3.4.0

echo ==============================================================
echo   MARSHMALLOW - PUBLICAR BACKEND 3.4.0
echo ==============================================================
echo.
node --check backend\src\index.js || goto :fail
pushd backend
if not exist node_modules\wrangler\package.json call npm install --no-audit --no-fund
if errorlevel 1 goto :failpop
call npx wrangler whoami
if errorlevel 1 call npx wrangler login
if errorlevel 1 goto :failpop
call npx wrangler deploy
if errorlevel 1 goto :failpop
popd

echo.
echo [OK] Deploy solicitado. Validando health...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u=(Get-Content '.watch_backend_url' -Raw).Trim(); $r=Invoke-RestMethod ($u+'/health?_mm='+[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) -TimeoutSec 30; if(-not $r.ok){exit 1}; $r | ConvertTo-Json -Depth 4"
if errorlevel 1 goto :fail
echo [OK] Backend respondeu ao health check.
exit /b 0

:failpop
popd
:fail
echo [ERRO] Backend nao foi confirmado como publicado.
exit /b 1
