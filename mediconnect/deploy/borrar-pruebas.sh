#!/usr/bin/env bash
# Borra los datos de pacientes de las pruebas (conversaciones, pacientes, citas, alertas, encuestas) para empezar
# limpio con el número real. Conserva médicos, especialidades, horarios, bloqueos, usuarios, plantillas y avisos.
# Las citas de prueba que llegaron a Google Calendar también se borran de los calendarios (en el minuto siguiente).
# Antes guarda una copia completa de la base.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/borrar-pruebas.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
cd "$APP"
run() { runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/reset-cli.ts --db="$DB" "$@"; }

run
echo
echo "Se conservan: médicos, especialidades, horarios, bloqueos, usuarios, plantillas y configuración."
read -rp "Para borrar, escriba BORRAR (en mayúsculas): " OK
[ "$OK" = "BORRAR" ] || { echo "Cancelado. No se borró nada."; exit 1; }

COPIA="/var/lib/mediconnect/backups/antes-de-borrar-pruebas-$(date +%Y%m%d-%H%M).db"
mkdir -p /var/lib/mediconnect/backups
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
new DatabaseSync(process.argv[1]).exec(`VACUUM INTO '"'"'${process.argv[2]}'"'"'`);' "$DB" "$COPIA"
chmod 600 "$COPIA"
echo "Copia de seguridad: $COPIA"
run --si
echo
echo "LISTO. Las citas de prueba se borrarán de Google Calendar en el próximo minuto."
