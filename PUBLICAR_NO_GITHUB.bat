@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ==============================================================
echo   MARSHMALLOW - PUBLICAR REGISTRO OFICIAL NO GITHUB
echo ==============================================================
echo.
echo Este repositorio publica documentacao e prova de autoria.
echo O codigo-fonte completo do navegador NAO sera publicado.
echo.
where git >nul 2>&1 || (
  echo [ERRO] Git nao encontrado.
  pause
  exit /b 1
)
where gh >nul 2>&1 || (
  echo GitHub CLI nao encontrado. Tentando instalar pelo winget...
  where winget >nul 2>&1 || (
    echo [ERRO] winget nao encontrado. Instale GitHub CLI em https://cli.github.com/
    pause
    exit /b 1
  )
  winget install --id GitHub.cli -e --source winget
  echo.
  echo Feche esta janela, abra novamente este BAT e continue.
  pause
  exit /b 0
)

gh auth status >nul 2>&1 || (
  echo O navegador sera aberto para autorizar sua conta GitHub.
  gh auth login --web --git-protocol https
  if errorlevel 1 exit /b 1
)

set "REPO=MarshMallow-Browser"
set /p REPO=Nome do repositorio [%REPO%]: 
if "%REPO%"=="" set "REPO=MarshMallow-Browser"

if not exist .git git init

git config user.name >nul 2>&1 || git config user.name "Deivison Santos"
git add README.md AUTHORS.md COPYRIGHT.md TRADEMARK.md LICENSE-PROPRIETARY.txt NOTICE.md SECURITY.md PROOF_OF_AUTHORSHIP.md .gitignore assets legal

git diff --cached --quiet || git commit -m "Establish official MarshMallow Browser public project record"

git branch -M main

gh repo view "%REPO%" >nul 2>&1
if errorlevel 1 (
  gh repo create "%REPO%" --public --source=. --remote=origin --push --description "Official public record and releases for MarshMallow Browser"
) else (
  git remote get-url origin >nul 2>&1 || gh repo set-default "%REPO%"
  git push -u origin main
)

echo.
echo [OK] Publicacao concluida.
gh repo view "%REPO%" --web
endlocal
