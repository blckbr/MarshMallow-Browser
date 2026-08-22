@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow - Publicar registro oficial no GitHub

echo ==============================================================
echo   MARSHMALLOW - PUBLICAR REGISTRO OFICIAL NO GITHUB
echo ==============================================================
echo.
echo Este repositorio publica documentacao, releases e prova de autoria.
echo O codigo-fonte completo do navegador NAO sera publicado.
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo Git nao encontrado. Tentando instalar pelo winget...
  where winget >nul 2>&1 || goto :semwinget
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  echo.
  echo [ATENCAO] O Git foi instalado. Feche esta janela e execute o BAT novamente.
  pause
  exit /b 0
)

where gh >nul 2>&1
if errorlevel 1 (
  echo GitHub CLI nao encontrado. Tentando instalar pelo winget...
  where winget >nul 2>&1 || goto :semwinget
  winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
  echo.
  echo [ATENCAO] O GitHub CLI foi instalado. Feche esta janela e execute o BAT novamente.
  pause
  exit /b 0
)

echo [1/5] Conferindo login do GitHub...
gh auth status >nul 2>&1
if errorlevel 1 (
  echo O navegador sera aberto para autorizar sua conta GitHub.
  gh auth login --web --git-protocol https
  if errorlevel 1 goto :erro
)
echo [OK] GitHub autenticado.

set "REPO=MarshMallow-Browser"
set /p REPO=Nome do repositorio [MarshMallow-Browser]: 
if "%REPO%"=="" set "REPO=MarshMallow-Browser"

echo [2/5] Preparando Git local...
if not exist .git git init
for /f "delims=" %%U in ('gh api user --jq .login 2^>nul') do set "GHUSER=%%U"
if not defined GHUSER set "GHUSER=devsaex"
git config user.name >nul 2>&1 || git config user.name "Deivison Santos"
git config user.email >nul 2>&1 || git config user.email "%GHUSER%@users.noreply.github.com"

git add README.md CHANGELOG.md releases AUTHORS.md COPYRIGHT.md TRADEMARK.md LICENSE-PROPRIETARY.txt NOTICE.md SECURITY.md PROOF_OF_AUTHORSHIP.md .gitignore assets legal

git diff --cached --quiet
if errorlevel 1 git commit -m "Record MarshMallow 4.0 Native Compatibility Core"
git branch -M main

echo [3/5] Conferindo repositorio remoto...
gh repo view "%REPO%" --json url --jq .url > "%TEMP%\marshmallow-gh-url.txt" 2>nul
if errorlevel 1 (
  echo O repositorio ainda nao existe. Criando como PUBLICO...
  gh repo create "%REPO%" --public --description "Official public record and releases for MarshMallow Browser"
  if errorlevel 1 goto :erro
  gh repo view "%REPO%" --json url --jq .url > "%TEMP%\marshmallow-gh-url.txt" 2>nul
)
set "REMOTEURL="
set /p REMOTEURL=<"%TEMP%\marshmallow-gh-url.txt"
del /q "%TEMP%\marshmallow-gh-url.txt" >nul 2>&1
if not defined REMOTEURL goto :erro

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REMOTEURL%"
) else (
  git remote set-url origin "%REMOTEURL%"
)

echo [4/5] Enviando registro 4.0 ao GitHub...
git push -u origin main
if errorlevel 1 goto :erro

echo [5/5] Abrindo repositorio publicado...
echo.
echo [OK] Publicacao concluida.
echo %REMOTEURL%
start "" "%REMOTEURL%"
endlocal
exit /b 0

:semwinget
echo.
echo [ERRO] winget nao encontrado. Instale Git e GitHub CLI manualmente:
echo   https://git-scm.com/
echo   https://cli.github.com/
pause
exit /b 1

:erro
echo.
echo [ERRO] Nao foi possivel concluir a publicacao no GitHub.
echo Nenhuma senha ou token deve ser colado neste arquivo.
pause
exit /b 1
