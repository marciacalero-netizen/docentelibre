#!/usr/bin/env bash
# Pasa el servidor a la última versión con una base de datos NUEVA (la anterior se guarda en backups/)
# y activa HTTPS en el dominio indicado. Pensado para escribirse a mano si la terminal no permite pegar.
# Uso (como root):  cd /opt/mediconnect/mediconnect && git pull -q && bash deploy/reinstalar.sh correo@admin "Nombre" prosalud.mediconnectec.com
set -euo pipefail
EMAIL="${1:-}"; NOMBRE="${2:-}"; DOM="${3:-}"
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
[ -n "$EMAIL" ] && [ -n "$NOMBRE" ] && [ -n "$DOM" ] || { echo 'Uso: bash deploy/reinstalar.sh correo@admin "Nombre" dominio'; exit 1; }
DATA=/var/lib/mediconnect
DIR="$(cd "$(dirname "$0")" && pwd)"

systemctl stop mediconnect 2>/dev/null || true
mkdir -p "$DATA/backups"
SELLO=$(date +%Y%m%d-%H%M%S)
for f in "$DATA"/prosalud.db*; do [ -e "$f" ] && mv "$f" "$DATA/backups/anterior-$SELLO-$(basename "$f")"; done
echo "Base de datos anterior guardada en $DATA/backups (anterior-$SELLO-*)."

bash "$DIR/instalar-servidor.sh" "$EMAIL" "$NOMBRE"
bash "$DIR/activar-https.sh" "$DOM"
