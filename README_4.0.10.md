# MarshMallow 4.0.10 — Inicialização robusta no Windows

Esta versão corrige a falha observada no teste 4.0.9 quando havia uma instância/processo de desenvolvimento anterior ainda usando a porta 1421 e o perfil Chromium.

## Corrigido

- A porta do Vite não é mais fixa: o launcher procura automaticamente uma porta livre entre 1421 e 1440.
- O MarshMallow passa a usar bloqueio de instância única; uma segunda abertura não disputa o mesmo perfil persistente.
- O launcher encerra apenas processos de desenvolvimento antigos pertencentes à mesma pasta do MarshMallow antes de iniciar uma nova sessão de teste.
- Nenhum cookie, histórico, login, favorito ou dado de navegação é apagado por essa limpeza de processos.
- Removido o aviso futuro do Vite relacionado a `__dirname` no `vite.config.ts`, usando `import.meta.dirname`.
- Mantidas todas as funções da 4.0.9, inclusive o bloqueio de reprodução de mídia em abas de segundo plano até a primeira ativação.

## Por que apareciam os erros de cache

Os erros `Unable to create cache`, `GPU Cache Creation failed` e `Database IO error` apareciam junto com `Port 1421 is already in use`. Isso é compatível com duas execuções de desenvolvimento disputando a mesma porta e o mesmo perfil Chromium no Windows. A 4.0.10 impede esse cenário.

## Teste

Execute `VALIDAR_MARSHMALLOW_4.0.10.bat` e depois `TESTAR_VIDEO_SEGUNDO_PLANO_4.0.10.bat`.
