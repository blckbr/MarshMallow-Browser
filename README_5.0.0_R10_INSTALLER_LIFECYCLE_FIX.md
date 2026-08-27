# MarshMallow 5.0.0 — R10 Installer Lifecycle Fix

## Problema corrigido

Ao instalar/atualizar com o MarshMallow aberto, o NSIS gerado pelo electron-builder exibia uma caixa técnica dizendo que o aplicativo estava funcionando e pedindo OK/Cancelar. Esse texto não pertence à experiência final do MarshMallow.

## Novo fluxo

1. O instalador detecta o processo do MarshMallow.
2. Inicia uma segunda instância com `--prepare-update`.
3. A instância já aberta recebe o pedido pela trava de instância única e chama `app.quit()`.
4. O fluxo normal de encerramento salva sessão, cookies e armazenamento antes de sair.
5. O instalador concede até 5 segundos ao encerramento gracioso antes de qualquer fallback.
6. Se o processo não responder, há fallback de encerramento normal e, somente por último, forçado.
7. Apenas se o Windows impedir todos os métodos aparece uma mensagem simples do MarshMallow pedindo para fechar manualmente e executar o instalador de novo. Os textos crus `appRunning` / `appCannotBeClosed` não são usados.

## Dados do usuário

A correção não remove AppData, perfil, cookies, favoritos, histórico ou sessão. O processo principal recebe a oportunidade de executar o fluxo normal de persistência antes do instalador substituir arquivos.

## Teste obrigatório no Windows

- Instale o MarshMallow.
- Abra algumas abas.
- Sem fechar o navegador, execute novamente `MarshMallow-Setup-5.0.0.exe`.
- Confirme que o navegador fecha automaticamente e o instalador prossegue sem a caixa técnica mostrada no R9.
- Abra o MarshMallow depois e confirme a restauração da sessão normal.

O script `REGISTRAR_SMOKE_5.0.0.bat` inclui esse cenário como gate de publicação.
