#!/usr/bin/env bash
# Solo lectura: muestra si están llegando mensajes de WhatsApp (cantidades por día, sin datos de pacientes),
# el estado del número en Meta y los últimos avisos del servidor sobre WhatsApp.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/actividad.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
DB=/var/lib/mediconnect/prosalud.db
echo "== Servicio =="; systemctl is-active mediconnect || true
echo; echo "== Mensajes por día (últimos 7 días) =="
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const c = db.prepare("SELECT name, whatsapp_phone_id AS pid FROM clinics ORDER BY id LIMIT 1").get();
console.log(`Clínica: ${c.name} · número asociado (ID): ${c.pid}`);
const rows = db.prepare(`SELECT substr(created_at,1,10) d, SUM(direction="in") entrantes, SUM(direction="out") salientes, COUNT(DISTINCT conversation_id) chats
  FROM messages WHERE created_at >= datetime("now","-7 days") GROUP BY d ORDER BY d`).all();
if (!rows.length) console.log("Ningún mensaje en los últimos 7 días.");
for (const r of rows) console.log(`${r.d}: ${r.entrantes} recibidos, ${r.salientes} enviados, ${r.chats} chat(s)`);
const last = db.prepare(`SELECT MAX(created_at) t FROM messages WHERE direction="in"`).get().t;
console.log(`Último mensaje recibido: ${last ? new Date(last).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "ninguno"}`);' "$DB"
echo; echo "== Últimos avisos del servidor sobre WhatsApp (24 h) =="
journalctl -u mediconnect --since "24 hours ago" --no-pager 2>/dev/null | grep -i "whatsapp\|webhook\|error" | tail -n 15 || echo "(sin avisos)"
