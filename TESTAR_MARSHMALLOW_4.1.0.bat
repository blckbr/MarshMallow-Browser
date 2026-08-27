@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title MarshMallow 4.1.0 - Smoke Test

echo ==============================================================
echo   MARSHMALLOW 4.1.0 - TESTE MANUAL FINAL
echo ==============================================================
echo.
echo 1. Nova aba: escolha uma foto WebP/AVIF e teste "Windows".
echo 2. Reinicie e confirme a restauracao opcional das abas normais.
echo 3. Abra um video em nova aba em segundo plano: ele nao deve tocar antes do primeiro acesso.
echo 4. Pressione F12 e Ctrl+Shift+I: DevTools deve abrir.
echo 5. Pressione Ctrl+Shift+E: a pagina de Extensoes deve abrir.
echo 6. Ative Modo desenvolvedor e carregue uma extensao descompactada simples.
echo 7. Teste habilitar/desabilitar/recarregar/remover a extensao.
echo 8. Em uma pagina com audio/video direto, abra o botao de Midia e teste Original.
echo 9. Se FFmpeg estiver instalado, teste MP3 e MP4.
echo 10. Teste fullscreen de video, Watch Together, login, favoritos, historico e aba privada.
echo.
echo O MarshMallow nao deve prometer download de conteudo protegido por DRM.
echo.
pause
call "%~dp0INICIAR_MARSHMALLOW_4.1.0.bat"
