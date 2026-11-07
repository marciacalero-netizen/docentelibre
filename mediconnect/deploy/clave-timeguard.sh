#!/usr/bin/env bash
# Pone una clave de adulto nueva en Game Time Guard (por si se olvidó). Genera una clave al azar, la guarda cifrada
# y reinicia el servicio (eso borra el bloqueo por intentos fallidos). No toca juegos, horarios, uso ni el token de la PC.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/clave-timeguard.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
APP=/opt/timeguard/game-time-guard/backend
DB=/var/lib/timeguard/game-time-guard.sqlite3
[ -f "$DB" ] || { echo "No se encontró la base de Game Time Guard ($DB)."; exit 1; }
read -rp "Se reemplazará la clave de adulto de Game Time Guard. ¿Continuar? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }
cd "$APP"
CLAVE=$(runuser -u timeguard -- /usr/local/bin/node -e "
const D = require('better-sqlite3'), bcrypt = require('bcryptjs'), crypto = require('crypto');
// Clave fácil de escribir: sin letras que se confunden (0/O, 1/l/I)
const abc = 'abcdefghjkmnpqrstuvwxyz23456789'; let pw = '';
for (const b of crypto.randomBytes(10)) pw += abc[b % abc.length];
pw = pw.slice(0, 5) + '-' + pw.slice(5);
const d = new D(process.argv[1]);
const r = d.prepare('UPDATE settings SET admin_password_hash = ? WHERE id = 1').run(bcrypt.hashSync(pw, 10));
d.close();
if (!r.changes) { console.error('No se encontró la configuración.'); process.exit(2); }
console.log(pw);" "$DB") || exit 1
systemctl restart timeguard
echo
echo "Clave de adulto nueva (anótela; no la fotografíe ni la envíe por chat):"
echo
echo "  $CLAVE"
echo
echo "Entre a https://gametimeguard.mediconnectec.com con esta clave. Luego puede cambiarla desde el panel por una que recuerde."
