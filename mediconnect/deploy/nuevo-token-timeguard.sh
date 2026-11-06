#!/usr/bin/env bash
# Genera un token nuevo para el agente de Game Time Guard (por si el anterior se vio o se compartió).
# El agente de la PC deja de conectarse hasta que se le ponga el token nuevo en agent-config.json.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/nuevo-token-timeguard.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
APP=/opt/timeguard/game-time-guard/backend
DB=/var/lib/timeguard/game-time-guard.sqlite3
[ -f "$DB" ] || { echo "No se encontró la base de Game Time Guard ($DB)."; exit 1; }
read -rp "El agente de la PC dejará de conectarse hasta poner el token nuevo. ¿Continuar? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }
cd "$APP"
TOKEN=$(runuser -u timeguard -- /usr/local/bin/node -e "
const D=require('better-sqlite3');const t=require('crypto').randomBytes(24).toString('hex');
const d=new D(process.argv[1]);d.prepare('UPDATE settings SET device_token = ? WHERE id = 1').run(t);d.close();console.log(t);" "$DB")
echo
echo "Token nuevo (no lo fotografíe ni lo envíe por chat; cópielo directamente):"
echo
echo "  $TOKEN"
echo
echo "Póngalo en la PC (PowerShell como administrador) y reinicie el agente. También se ve en el panel → «Vincular la PC»."
