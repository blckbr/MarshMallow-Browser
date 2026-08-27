# MarshMallow 3.0.1 — Windows Launcher Fix

Corrige `Error: spawn EINVAL` no Node.js 24 no Windows.

Causa:
- o launcher 3.0.0 tentava executar `npm.cmd` e `npx.cmd` diretamente por
  `child_process.spawn()`.

Correção:
- `npm run dev:web` é iniciado através de `cmd.exe`;
- Electron é iniciado diretamente por
  `node_modules\electron\dist\electron.exe`;
- o script verifica se o executável do Electron existe;
- encerramento do Vite/Electron foi reforçado.

Uso:
1. substitua o conteúdo do projeto pelo pacote 3.0.1;
2. execute `INICIAR_MARSHMALLOW_ELECTRON.bat`.

Há também `INICIAR_MARSHMALLOW_DIRETO.bat`, que não depende do `scripts/dev.mjs`
para abrir o Electron.
