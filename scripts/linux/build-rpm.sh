#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
OUTPUT="$ROOT/release-linux"
EXPECTED="$OUTPUT/MarshMallow-Browser-5.0.2-x86_64.rpm"

"$SCRIPT_DIR/verify-linux.sh"
cd "$ROOT"
rm -f "$OUTPUT"/*.rpm 2>/dev/null || true
npm run dist:linux:rpm

if [[ ! -f "$EXPECTED" ]]; then
  mapfile -t candidates < <(find "$OUTPUT" -maxdepth 1 -type f -name 'MarshMallow-Browser-5.0.2-*.rpm' -print | sort)
  if [[ ${#candidates[@]} -ne 1 ]]; then
    echo '[FALHA] O RPM 5.0.2 não foi gerado de forma inequívoca.' >&2
    printf 'Encontrados: %s\n' "${candidates[*]:-nenhum}" >&2
    exit 4
  fi
  mv -- "${candidates[0]}" "$EXPECTED"
fi

[[ -s "$EXPECTED" ]] || { echo '[FALHA] RPM vazio.' >&2; exit 5; }
echo "[OK] RPM: $EXPECTED"
