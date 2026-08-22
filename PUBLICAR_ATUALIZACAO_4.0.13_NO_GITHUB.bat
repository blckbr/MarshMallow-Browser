@echo off
setlocal
cd /d "%~dp0"
echo ============================================
echo MarshMallow 4.0.13 - Publicar no GitHub
echo ============================================
where gh >nul 2>&1 || winget install --id GitHub.cli -e --source winget
where git >nul 2>&1 || winget install --id Git.Git -e --source winget
where gh >nul 2>&1 || (echo GitHub CLI nao encontrado.& pause & exit /b 1)
gh auth status >nul 2>&1 || gh auth login --web --git-protocol https
if not exist .git git init
git config user.name "Deivison Santos"
git add .
git commit -m "MarshMallow 4.0.13 - Windows wallpaper and AI RAM tools"
gh repo view MarshMallow-Browser >nul 2>&1
if errorlevel 1 gh repo create MarshMallow-Browser --public --source=. --remote=origin --description "Official public record of MarshMallow Browser"
git branch -M main
git remote get-url origin >nul 2>&1 || git remote add origin https://github.com/blckbr/MarshMallow-Browser.git
git push -u origin main
pause
