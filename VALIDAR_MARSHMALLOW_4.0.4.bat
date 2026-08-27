@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.0.4 - Validacao Omnibox + Corretor

echo ==============================================================
echo   MARSHMALLOW 4.0.4 - AUTOPREENCHIMENTO + CORRETOR
echo ==============================================================
echo.

if not exist package.json (
  echo [ERRO] package.json nao encontrado.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Get-Content -Raw '.\package.json'|ConvertFrom-Json; if($p.version -ne '4.0.4'){Write-Host '[ERRO] Versao inesperada:' $p.version; exit 1}; Write-Host '[OK] Versao 4.0.4'"
if errorlevel 1 goto :erro

findstr /c:"buildAddressSuggestions" "src\App.tsx" >nul || goto :erro
findstr /c:"addressSuggestionsEnabled" "src\App.tsx" >nul || goto :erro
findstr /c:"Tab preencher" "src\App.tsx" >nul || goto :erro
echo [OK] Omnibox inteligente presente.

findstr /c:"dictionarySuggestions" "electron\main.mjs" >nul || goto :erro
findstr /c:"replaceMisspelling" "electron\main.mjs" >nul || goto :erro
findstr /c:"addWordToSpellCheckerDictionary" "electron\main.mjs" >nul || goto :erro
echo [OK] Sugestoes ortograficas nativas presentes.

findstr /c:"persist:marshmallow" "electron\main.mjs" >nul || goto :erro
echo [OK] Perfil persistente preservado.

node --check "electron\main.mjs"
if errorlevel 1 goto :erro
node --check "electron\preload.cjs"
if errorlevel 1 goto :erro
echo [OK] Sintaxe Electron validada.

echo.
echo [OK] Validacao local concluida.
echo Agora execute INICIAR_MARSHMALLOW_4.0.4.bat.
echo Teste 1: visite Google e Gmail, depois digite go e gm na barra.
echo Teste 2: escreva uma palavra errada em um campo de texto e clique com botao direito.
pause
exit /b 0

:erro
echo.
echo [ERRO] A validacao encontrou um problema nos arquivos 4.0.4.
pause
exit /b 1
