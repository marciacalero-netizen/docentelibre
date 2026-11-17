#!/usr/bin/env bash
# Cambia el número de WhatsApp con el que atiende Gia (por ejemplo, del chip piloto al número principal del centro).
# Lista los números de la cuenta de WhatsApp (WABA), deja elegir uno, lo asocia a la clínica y reinicia el servicio.
# No pide ni muestra secretos: usa el token ya guardado en /etc/mediconnect/mediconnect.env.
# Después ejecute deploy/registrar-numero.sh para registrar el número en la API con su PIN.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/cambiar-numero.sh <id-de-la-cuenta-de-WhatsApp-WABA>
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
ENV=/etc/mediconnect/mediconnect.env
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
WABA="${1:-}"
[[ "$WABA" =~ ^[0-9]{5,20}$ ]] || { echo "Uso: bash deploy/cambiar-numero.sh <id-de-la-cuenta-de-WhatsApp (WABA), solo dígitos>"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV. Ejecute primero deploy/configurar-whatsapp.sh."; exit 1; }

echo "Consultando a Meta los números de la cuenta…"
LISTA=$(WA_TOKEN="$TOKEN" WA_ID="$WABA" node --input-type=module -e '
const v = process.env.WHATSAPP_API_VERSION || "v21.0";
let r; try { r = await fetch(`https://graph.facebook.com/${v}/${process.env.WA_ID}/phone_numbers?fields=id,display_phone_number,verified_name,status`, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` }, signal: AbortSignal.timeout(20000) }); }
catch (e) { console.error("No se pudo contactar a Meta: " + (e.cause?.code ?? e.message)); process.exit(2); }
const b = await r.json().catch(() => ({}));
if (!r.ok) { console.error("Meta respondió: " + (b.error?.message ?? "sin detalle")); process.exit(2); }
if (!b.data?.length) { console.error("Esa cuenta no tiene números."); process.exit(2); }
for (const n of b.data) console.log([n.id, n.display_phone_number, n.verified_name ?? "", n.status ?? ""].join("|"));
') || exit 1
ACTUAL=$(runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
console.log(new DatabaseSync(process.argv[1], { readOnly: true }).prepare("SELECT whatsapp_phone_id AS id FROM clinics ORDER BY id LIMIT 1").get()?.id ?? "");' "$DB")
echo
i=0; while IFS='|' read -r id num name st; do i=$((i+1)); echo "  $i) $num  ($name, $st)$([ "$id" = "$ACTUAL" ] && echo '   ← Gia atiende hoy aquí')"; done <<< "$LISTA"
TOTAL=$(printf '%s\n' "$LISTA" | grep -c .)
read -rp "¿Con qué número debe atender Gia? Escriba el número de la lista (1-$TOTAL): " ELEGIDO
[[ "$ELEGIDO" =~ ^[0-9]+$ ]] && [ "$ELEGIDO" -ge 1 ] && [ "$ELEGIDO" -le "$TOTAL" ] || { echo "Opción no válida. No se cambió nada."; exit 1; }
LINEA=$(printf '%s\n' "$LISTA" | sed -n "${ELEGIDO}p")
PHONE_ID=${LINEA%%|*}; RESTO=${LINEA#*|}; NUMERO=${RESTO%%|*}
[ "$PHONE_ID" != "$ACTUAL" ] || { echo "Gia ya atiende en $NUMERO. No se cambió nada."; exit 0; }
read -rp "Gia pasará a atender en $NUMERO. ¿Confirma? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }

# Copia de la base por si hay que volver atrás (VACUUM INTO es seguro con el servicio en marcha)
COPIA="/var/lib/mediconnect/backups/antes-cambio-numero-$(date +%Y%m%d-%H%M).db"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
new DatabaseSync(process.argv[1]).exec(`VACUUM INTO '"'"'${process.argv[2]}'"'"'`);' "$DB" "$COPIA"
cd "$APP"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/whatsapp-cli.ts "$PHONE_ID" --db="$DB"
systemctl restart mediconnect
sleep 3
systemctl is-active --quiet mediconnect || { echo "MediConnect no arrancó. Revise: journalctl -u mediconnect -n 30"; exit 1; }
echo
echo "LISTO: Gia quedó asociada a $NUMERO."
echo "Ahora registre ese número con su PIN:  bash deploy/registrar-numero.sh $WABA"
