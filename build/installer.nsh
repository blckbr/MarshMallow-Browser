# MarshMallow 5.0 — fluxo profissional para instalação/atualização
#
# Substitui o CHECK_APP_RUNNING padrão do electron-builder. O objetivo é fechar
# o navegador de forma silenciosa e previsível durante instalação/atualização,
# sem expor ao usuário as MessageBox técnicas appRunning/appCannotBeClosed.

# Quando customCheckAppRunning existe, electron-builder não declara a variável
# pid usada pelo próprio KILL_PROCESS. Declaramos aqui e preenchemos com o PID
# real do instalador antes de chamar qualquer fallback.
Var pid

!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  StrCpy $pid $0

  # Se alguém renomear o instalador para MarshMallow.exe, não confunda o próprio
  # instalador com o processo do navegador.
  ${if} $EXEFILE != "${APP_EXECUTABLE_FILENAME}"
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0

    ${if} $R0 == 0
      DetailPrint "Preparando o MarshMallow para a instalação..."

      # Caminho principal: dispara uma segunda instância especial. A instância
      # já aberta recebe --prepare-update pelo single-instance lock e chama
      # app.quit(), permitindo salvar sessão, cookies e storage normalmente.
      IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 +3
        ExecWait '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --prepare-update'
        Sleep 5000

      !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0

      # Fallback 1: encerramento sem força, restrito ao app instalado/usuário.
      ${if} $R0 == 0
        DetailPrint "Aguardando o MarshMallow encerrar..."
        !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
        Sleep 1000
        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${endIf}

      # Fallback 2: força apenas um processo realmente preso.
      ${if} $R0 == 0
        DetailPrint "Finalizando um processo do MarshMallow que não respondeu..."
        !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
        Sleep 1000
        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
      ${endIf}

      # Caso excepcional: Windows/antivírus/política bloqueou todos os métodos.
      # Mostra mensagem do produto, clara e acionável, em vez do texto cru NSIS.
      ${if} $R0 == 0
        MessageBox MB_OK|MB_ICONEXCLAMATION|MB_TOPMOST \
          "O MarshMallow precisa ser fechado para concluir a instalação/atualização.$\r$\n$\r$\nSalve o que estiver fazendo, feche o MarshMallow e execute este instalador novamente." \
          /SD IDOK
        Quit
      ${endIf}
    ${endIf}
  ${endIf}
!macroend
