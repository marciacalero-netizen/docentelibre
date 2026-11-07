#!/usr/bin/env bash
# Pide un código nuevo (SMS o llamada) para un número ya agregado a la cuenta de WhatsApp y lo verifica.
# Útil si el SMS de deploy/agregar-numero.sh no llegó. No cambia nada más.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/verificar-numero.sh <ID-del-número>
set -euo pipefail
ENV="${MC_ENV:-/etc/mediconnect/mediconnect.env}"
[ -n "${MC_ENV:-}" ] || [ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
PHONE_ID="${1:-}"
[[ "$PHONE_ID" =~ ^[0-9]{5,20}$ ]] || { echo "Uso: bash deploy/verificar-numero.sh <ID del número, el que mostró agregar-numero.sh>"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV."; exit 1; }

graph() {   # graph RUTA parámetros
  WA_TOKEN="$TOKEN" WA_PATH="$1" WA_FORM="$2" node --input-type=module -e '
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", base = e.WA_GRAPH_BASE || "https://graph.facebook.com";
let r; try { r = await fetch(`${base}/${v}/${e.WA_PATH}`, { method: "POST", headers: { Authorization: `Bearer ${e.WA_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" }, body: e.WA_FORM, signal: AbortSignal.timeout(30000) }); }
catch (err) { console.log("✗ No se pudo contactar a Meta: " + (err.cause?.code ?? err.message)); process.exit(2); }
const b = await r.json().catch(() => ({}));
if (!r.ok) { const x = b.error ?? {}; console.log(`✗ Meta respondió: ${x.error_user_msg || x.message || "sin detalle"}${x.code ? ` (código ${x.code}${x.error_subcode ? "/" + x.error_subcode : ""})` : ""}`); process.exit(3); }'
}

read -rp "¿Cómo enviar el código? Escriba L para llamada o S para SMS: " M
[[ "$M" =~ ^[sS]$ ]] && METHOD=SMS || METHOD=VOICE
graph "$PHONE_ID/request_code" "code_method=$METHOD&language=es" || { echo "No se pudo pedir el código. Si dice que espere, intente en unos minutos. Envíeme una foto."; exit 1; }
echo "✓ Código pedido por $([ "$METHOD" = SMS ] && echo SMS || echo llamada). Tenga el celular del chip a mano."
while :; do
  read -rp "Escriba el código de 6 dígitos: " CODE; CODE=$(printf '%s' "$CODE" | tr -cd '0-9')
  [[ "$CODE" =~ ^[0-9]{6}$ ]] && break
  echo "   ✗ Deben ser 6 dígitos."
done
graph "$PHONE_ID/verify_code" "code=$CODE" || { echo "El código no se aceptó. Puede volver a ejecutar este comando."; exit 1; }
echo "✓ Número verificado."
echo "Siga con:  bash deploy/cambiar-numero.sh <WABA>   y luego   bash deploy/registrar-numero.sh <WABA>"
