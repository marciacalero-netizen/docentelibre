#!/usr/bin/env bash
# Pone en Gia las promociones de config/promociones.txt y agrega el servicio Podología si aún no existe. No borra ni cambia los demás servicios, médicos, citas ni pacientes.
# Después se pueden editar en el panel: Configuración → «Promociones vigentes».
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/actualizar-promociones.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
cd "$APP"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/promos-cli.ts --db="$DB"
systemctl restart mediconnect
echo "LISTO. Pruebe escribiendo a Gia: «promociones»."
