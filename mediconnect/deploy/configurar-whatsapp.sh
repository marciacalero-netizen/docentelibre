#!/usr/bin/env bash
# Carga las credenciales de WhatsApp (Cloud API) en el servidor y enciende el canal.
# Pide los secretos sin mostrarlos en pantalla y los guarda SOLO en /etc/mediconnect/mediconnect.env (solo root).
# Genera el token de verificación del webhook y lo muestra para copiarlo en Meta.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/configurar-whatsapp.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
ENV=/etc/mediconnect/mediconnect.env
APP=/opt/mediconnect/mediconnect
DB=/var/lib/mediconnect/prosalud.db
[ -f "$ENV" ] || { echo "No existe $ENV. Instale primero MediConnect."; exit 1; }

echo "Pegue cada dato y pulse Enter. Por seguridad, la clave y el token NO se verán al pegarlos."
# Cada pregunta se repite hasta recibir un dato válido (así nada pegado de más cae en la terminal).
limpia() { printf '%s' "$1" | tr -d '[:space:]'; }
while :; do
  read -rsp "1/3  Clave secreta de la app (App Secret): " SECRET; echo; SECRET=$(limpia "$SECRET")
  [[ "$SECRET" =~ ^[A-Za-z0-9]{16,64}$ ]] && break
  echo "   ✗ Eso no parece la clave secreta (deben ser unas 32 letras y números). Cópiela de nuevo y péguela."
done
echo "   ✓ Clave recibida (${#SECRET} caracteres)."
while :; do
  read -rsp "2/3  Token permanente del usuario del sistema: " TOKEN; echo; TOKEN=$(limpia "$TOKEN")
  [[ "$TOKEN" =~ ^[A-Za-z0-9_-]{50,1000}$ ]] && break
  echo "   ✗ Eso no parece un token (es un texto largo que suele empezar con EAA). Cópielo de nuevo y péguelo."
done
echo "   ✓ Token recibido (${#TOKEN} caracteres)."
while :; do
  read -rp  "3/3  Identificador de la cuenta de WhatsApp (WABA) o del número de teléfono (solo dígitos): " ASSET_ID; ASSET_ID=$(limpia "$ASSET_ID")
  [[ "$ASSET_ID" =~ ^[0-9]{5,20}$ ]] && break
  echo "   ✗ Deben ser solo dígitos."
done

# Busca en Meta los números de esa cuenta usando el token (el token va por variable de entorno, nunca en la línea de comandos).
echo "Consultando a Meta los números de esa cuenta…"
LISTA=$(WA_TOKEN="$TOKEN" WA_ID="$ASSET_ID" node --input-type=module -e '
const v = process.env.WHATSAPP_API_VERSION || "v21.0", id = process.env.WA_ID;
const get = async (path) => { let r; try { r = await fetch(`https://graph.facebook.com/${v}/${path}`, { headers: { Authorization: `Bearer ${process.env.WA_TOKEN}` }, signal: AbortSignal.timeout(20000) }); } catch (e) { console.error("No se pudo contactar a Meta: " + (e.cause?.code ?? e.message)); process.exit(2); } return { ok: r.ok, body: await r.json().catch(() => ({})) }; };
let r = await get(`${id}/phone_numbers?fields=id,display_phone_number,verified_name,status`);
let rows = r.ok ? (r.body.data ?? []) : null;
if (!rows) { const p = await get(`${id}?fields=id,display_phone_number,verified_name,status`); if (p.ok && p.body.display_phone_number) rows = [p.body]; }
if (!rows) { console.error("Meta respondió: " + (r.body?.error?.message ?? "sin detalle") + ". Revise el token y el identificador."); process.exit(2); }
if (!rows.length) { console.error("Esa cuenta no tiene números."); process.exit(2); }
for (const n of rows) console.log([n.id, n.display_phone_number, n.verified_name ?? "", n.status ?? ""].join("|"));
') || exit 1
echo
i=0; while IFS='|' read -r id num name st; do i=$((i+1)); echo "  $i) $num  ($name, $st)"; done <<< "$LISTA"
TOTAL=$(printf '%s\n' "$LISTA" | grep -c .)
if [ "$TOTAL" = 1 ]; then ELEGIDO=1; else read -rp "¿Cuál es el chip piloto? Escriba el número de la lista (1-$TOTAL): " ELEGIDO; fi
[[ "$ELEGIDO" =~ ^[0-9]+$ ]] && [ "$ELEGIDO" -ge 1 ] && [ "$ELEGIDO" -le "$TOTAL" ] || { echo "Opción no válida."; exit 1; }
LINEA=$(printf '%s\n' "$LISTA" | sed -n "${ELEGIDO}p")
PHONE_ID=${LINEA%%|*}; RESTO=${LINEA#*|}; NUMERO=${RESTO%%|*}
read -rp "Se usará el número $NUMERO. ¿Es el chip piloto? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }

VERIFY=$(grep -E '^WHATSAPP_VERIFY_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$VERIFY" ] || VERIFY="mc-$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')"

TMP=$(mktemp)
grep -vE '^(WHATSAPP_ENABLED|WHATSAPP_VERIFY_TOKEN|WHATSAPP_APP_SECRET|WHATSAPP_TOKEN)=' "$ENV" > "$TMP" || true
{ echo "WHATSAPP_ENABLED=true"; echo "WHATSAPP_VERIFY_TOKEN=$VERIFY"; echo "WHATSAPP_APP_SECRET=$SECRET"; echo "WHATSAPP_TOKEN=$TOKEN"; } >> "$TMP"
install -m 600 -o root -g root "$TMP" "$ENV"; rm -f "$TMP"
unset SECRET TOKEN

cd "$APP"
runuser -u mediconnect -- node --disable-warning=ExperimentalWarning src/whatsapp-cli.ts "$PHONE_ID" --db="$DB"
systemctl restart mediconnect
sleep 3
systemctl is-active --quiet mediconnect || { echo "MediConnect no arrancó. Revise: journalctl -u mediconnect -n 30"; exit 1; }

DOM=$(grep -oE '^[a-z0-9.-]+\.[a-z]{2,}' /etc/caddy/Caddyfile | head -1 || true)
echo
echo "LISTO: WhatsApp quedó encendido en el servidor."
echo "Ahora, en Meta → WhatsApp → Configuración → Webhook, escriba:"
echo "  URL de devolución de llamada:  https://${DOM:-<su-dominio>}/webhook/whatsapp"
echo "  Token de verificación:          $VERIFY"
echo "y suscriba el campo «messages»."
echo
echo "Para apagar WhatsApp: cambie WHATSAPP_ENABLED=true por false en $ENV y ejecute: systemctl restart mediconnect"
