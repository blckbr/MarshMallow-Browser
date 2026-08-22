@echo off
setlocal
cd /d "%~dp0"
where gh >nul 2>nul || (
  echo GitHub CLI nao encontrado. Tentando instalar...
  winget install --id GitHub.cli -e --source winget
)
where git >nul 2>nul || (
  echo Git nao encontrado. Tentando instalar...
  winget install --id Git.Git -e --source winget
)
gh auth status >nul 2>nul || gh auth login --web --git-protocol https
if not exist .git (
  git init
  git branch -M main
  git remote add origin https://github.com/devsaex/MarshMallow-Browser.git
)
git add .
git commit -m "MarshMallow 4.0.9 - background media waits for tab activation" || echo Nenhuma alteracao nova para commit.
git push -u origin main
pause
