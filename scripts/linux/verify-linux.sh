#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
cd "$ROOT"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf '[FALHA] Comando obrigatório ausente: %s\n' "$command_name" >&2
    return 1
  fi
}

if [[ "$(uname -s)" != "Linux" ]]; then
  echo '[FALHA] Esta validação deve ser executada em Linux.' >&2
  exit 2
fi

require_command node
require_command npm
require_command unzip
require_command zip
require_command xdg-mime
require_command xdg-settings

if [[ ! -f package.json || ! -f electron/main.mjs || ! -f electron/preload.cjs ]]; then
  echo '[FALHA] Fonte do MarshMallow incompleta.' >&2
  exit 2
fi

if [[ ! -d node_modules ]]; then
  echo '[FALHA] node_modules ausente. Execute npm ci --no-audit --no-fund antes da validação.' >&2
  exit 3
fi

echo '[1/5] Testes unitários'
npm run test:unit

echo '[2/5] Sintaxe Electron main'
node --check electron/main.mjs

echo '[3/5] Sintaxe Electron preload'
node --check electron/preload.cjs

echo '[4/5] TypeScript'
npm run typecheck

echo '[5/5] Build web'
npm run build:web

echo '[OK] Fonte Linux validada.'
