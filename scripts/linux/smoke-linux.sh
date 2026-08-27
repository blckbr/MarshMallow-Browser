#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
BIN="$ROOT/release-linux/linux-unpacked/marshmallow-browser"
LOG="$ROOT/release-linux/linux-smoke.log"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo '[FALHA] Smoke test exige Linux.' >&2
  exit 2
fi
if [[ ! -x "$BIN" ]]; then
  echo "[FALHA] Runtime não encontrado: $BIN" >&2
  exit 3
fi
command -v timeout >/dev/null 2>&1 || { echo '[FALHA] timeout ausente.' >&2; exit 4; }

TMP_ROOT="$(mktemp -d -t marshmallow-smoke-XXXXXX)"
trap 'rm -rf -- "$TMP_ROOT"' EXIT
mkdir -p "$TMP_ROOT/home" "$TMP_ROOT/config" "$TMP_ROOT/cache" "$TMP_ROOT/data" "$TMP_ROOT/runtime" "$TMP_ROOT/user-data"
chmod 0700 "$TMP_ROOT/runtime"

DISPLAY_CMD=()
if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  command -v xvfb-run >/dev/null 2>&1 || { echo '[FALHA] Nenhum display e xvfb-run não está instalado.' >&2; exit 5; }
  DISPLAY_CMD=(xvfb-run -a)
fi

ENV_ARGS=(
  env
  HOME="$TMP_ROOT/home"
  XDG_CONFIG_HOME="$TMP_ROOT/config"
  XDG_CACHE_HOME="$TMP_ROOT/cache"
  XDG_DATA_HOME="$TMP_ROOT/data"
  XDG_RUNTIME_DIR="$TMP_ROOT/runtime"
)

RUN_PREFIX=()
if [[ "${EUID}" -eq 0 ]]; then
  command -v runuser >/dev/null 2>&1 || { echo '[FALHA] Smoke test não executa Electron como root e runuser está ausente.' >&2; exit 6; }
  id nobody >/dev/null 2>&1 || { echo '[FALHA] Usuário não privilegiado nobody ausente.' >&2; exit 6; }
  chown -R nobody "$TMP_ROOT"
  RUN_PREFIX=(runuser -u nobody --)
fi

mkdir -p "$(dirname -- "$LOG")"
set +e
timeout --signal=TERM --kill-after=3s 12s \
  "${RUN_PREFIX[@]}" "${DISPLAY_CMD[@]}" "${ENV_ARGS[@]}" \
  "$BIN" --user-data-dir="$TMP_ROOT/user-data" >"$LOG" 2>&1
RC=$?
set -e

if [[ "$RC" -eq 124 || "$RC" -eq 143 ]]; then
  echo '[OK] MarshMallow permaneceu ativo durante a janela de smoke test.'
  echo "[OK] Log: $LOG"
  exit 0
fi

echo "[FALHA] MarshMallow encerrou antes do período de estabilidade (código $RC)." >&2
cat "$LOG" >&2 || true
exit 7
