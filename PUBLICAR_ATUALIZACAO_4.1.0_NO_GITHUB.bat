@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.1.0 - Publicar GitHub

where gh >nul 2>nul
if errorlevel 1 (
  where winget >nul 2>nul || (echo [ERRO] GitHub CLI nao encontrado e winget indisponivel.& exit /b 1)
  echo Instalando GitHub CLI...
  winget install --id GitHub.cli -e --source winget --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\GitHub CLI"
)
where git >nul 2>nul
if errorlevel 1 (
  where winget >nul 2>nul || (echo [ERRO] Git nao encontrado e winget indisponivel.& exit /b 1)
  echo Instalando Git...
  winget install --id Git.Git -e --source winget --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
)
where gh >nul 2>nul || (echo [ERRO] GitHub CLI continua indisponivel.& exit /b 1)
where git >nul 2>nul || (echo [ERRO] Git continua indisponivel.& exit /b 1)
gh auth status >nul 2>nul || gh auth login
if errorlevel 1 exit /b 1

set "TMP=%TEMP%\MarshMallow-GitHub-4.1.0-%RANDOM%"
gh repo view blckbr/MarshMallow-Browser >nul 2>nul
if errorlevel 1 (
  gh repo create blckbr/MarshMallow-Browser --public --description "Official public project record for MarshMallow Browser"
  if errorlevel 1 exit /b 1
)

gh repo clone blckbr/MarshMallow-Browser "%TMP%"
if errorlevel 1 exit /b 1
robocopy "%~dp0" "%TMP%" /E /XD .git /XF "PUBLICAR_ATUALIZACAO_4.1.0_NO_GITHUB.bat" >nul
pushd "%TMP%"
git add -A
git diff --cached --quiet && goto :nocommit
git commit -m "MarshMallow 4.1.0 public release record"
if errorlevel 1 goto :fail
git push origin HEAD:main
if errorlevel 1 goto :fail
:nocommit
popd
rmdir /s /q "%TMP%" 2>nul
echo [OK] Registro publico 4.1.0 enviado ao GitHub.
exit /b 0
:fail
popd
rmdir /s /q "%TMP%" 2>nul
exit /b 1
