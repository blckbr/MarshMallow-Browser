#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

echo '=============================================================='
echo ' MARSHMALLOW 5.0.2 - BUILD LINUX RPM + APPIMAGE'
echo '=============================================================='
echo
"$ROOT/scripts/linux/build-appimage.sh"
"$ROOT/scripts/linux/build-rpm.sh"
echo
echo '[OK] Artefatos Linux concluídos em release-linux/'
