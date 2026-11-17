#!/usr/bin/env bash
# Restablece la contraseña de un usuario del panel de MediConnect (por ejemplo, la administradora que la olvidó).
# Genera una clave temporal; al entrar, el panel pide crear una propia. Cierra las sesiones abiertas de ese usuario
# (se reinicia el servicio). No cambia nada más.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/restablecer-clave.sh [correo]
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
cd "$APP"
echo "Usuarios del panel:"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
for (const u of new DatabaseSync(process.argv[1], { readOnly: true }).prepare("SELECT email, name, role, active FROM users ORDER BY role, email").all())
  console.log(`  ${u.email}  (${u.name}, ${u.role === "admin" ? "administrador" : "recepcionista"}${u.active ? "" : ", DESACTIVADO"})`);' "$DB"
EMAIL="${1:-}"
[ -n "$EMAIL" ] || read -rp "Correo del usuario a restablecer: " EMAIL
EMAIL=$(printf '%s' "$EMAIL" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
read -rp "Se pondrá una clave temporal a $EMAIL. ¿Continuar? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }
CLAVE=$(runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./src/auth.ts";
const db = new DatabaseSync(process.argv[1]);
const pw = randomBytes(9).toString("base64url");
const r = db.prepare("UPDATE users SET password_hash = ?, must_change = 1, active = 1 WHERE lower(email) = ?").run(hashPassword(pw), process.argv[2]);
if (!r.changes) { console.error("No existe un usuario con ese correo."); process.exit(2); }
console.log(pw);' "$DB" "$EMAIL") || exit 1
systemctl restart mediconnect   # cierra sesiones abiertas y limpia bloqueos por intentos fallidos
echo
echo "Clave temporal de $EMAIL (anótela; no la envíe por chat):"
echo
echo "  $CLAVE"
echo
echo "Entre a https://prosalud.mediconnectec.com/panel/ con ese correo y esta clave: el panel pedirá crear una propia."
