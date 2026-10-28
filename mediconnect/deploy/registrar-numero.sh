#!/usr/bin/env bash
# Registra en la API de WhatsApp (Cloud API) el número ya asociado a la clínica, con un PIN de 6 dígitos,
# y suscribe la app a la cuenta de WhatsApp (WABA) para que los mensajes lleguen al webhook.
# El PIN se pide sin mostrarlo y no se guarda en ningún archivo. El token se lee de /etc/mediconnect/mediconnect.env.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/registrar-numero.sh <id-de-la-cuenta-de-WhatsApp-WABA>
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
ENV=/etc/mediconnect/mediconnect.env
DB=/var/lib/mediconnect/prosalud.db
WABA="${1:-}"
[[ "$WABA" =~ ^[0-9]{5,20}$ ]] || { echo "Uso: bash deploy/registrar-numero.sh <id-de-la-cuenta-de-WhatsApp (WABA), solo dígitos>"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV. Ejecute primero deploy/configurar-whatsapp.sh."; exit 1; }
PHONE_ID=$(node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
const r = new DatabaseSync(process.argv[1], { readOnly: true }).prepare("SELECT whatsapp_phone_id AS id FROM clinics ORDER BY id LIMIT 1").get();
console.log(r?.id ?? "");' "$DB")
[ -n "$PHONE_ID" ] || { echo "La clínica no tiene número de WhatsApp asociado. Ejecute primero deploy/configurar-whatsapp.sh."; exit 1; }

# Llamadas a Meta: el token y el PIN viajan por variables de entorno, nunca en la línea de comandos.
graph() {   # graph MÉTODO RUTA [JSON]
  WA_TOKEN="$TOKEN" WA_METHOD="$1" WA_PATH="$2" WA_BODY="${3:-}" node --input-type=module -e '
const v = process.env.WHATSAPP_API_VERSION || "v21.0", e = process.env;
let r; try {
  r = await fetch(`https://graph.facebook.com/${v}/${e.WA_PATH}`, { method: e.WA_METHOD, headers: { Authorization: `Bearer ${e.WA_TOKEN}`, "Content-Type": "application/json" }, body: e.WA_BODY || undefined, signal: AbortSignal.timeout(30000) });
} catch (err) { console.log("✗ No se pudo contactar a Meta: " + (err.cause?.code ?? err.message)); process.exit(2); }
const b = await r.json().catch(() => ({}));
if (!r.ok) { const x = b.error ?? {}; console.log(`✗ Meta respondió: ${x.error_user_msg || x.message || "sin detalle"}${x.code ? ` (código ${x.code}${x.error_subcode ? "/" + x.error_subcode : ""})` : ""}`); process.exit(3); }
console.log(JSON.stringify(b));'
}

echo "Consultando el estado del número en Meta…"
INFO=$(graph GET "$PHONE_ID?fields=display_phone_number,verified_name,name_status,status,code_verification_status,quality_rating") || { echo "$INFO"; exit 1; }
printf '%s' "$INFO" | node -e '
const d = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
console.log(`  Número: ${d.display_phone_number}\n  Nombre: ${d.verified_name} (revisión del nombre: ${d.name_status ?? "?"})\n  Estado: ${d.status ?? "?"} · verificación por código: ${d.code_verification_status ?? "?"}`);'
read -rp "¿Es el número correcto y desea registrarlo ahora? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }

echo "Elija un PIN de 6 dígitos (verificación en dos pasos del número). Anótelo en un lugar seguro: Meta lo pedirá si el número se vuelve a registrar."
while :; do
  read -rsp "PIN (no se verá al escribirlo): " PIN; echo
  read -rsp "Repita el PIN: " PIN2; echo
  [[ "$PIN" =~ ^[0-9]{6}$ ]] && [ "$PIN" = "$PIN2" ] && break
  echo "   ✗ Deben ser 6 dígitos y coincidir. Intente de nuevo."
done

echo "Registrando el número…"
BODY=$(PIN="$PIN" node -e 'console.log(JSON.stringify({ messaging_product: "whatsapp", pin: process.env.PIN }))')
unset PIN PIN2
OUT=$(graph POST "$PHONE_ID/register" "$BODY") || { echo "$OUT"; echo "El número NO quedó registrado. Envíeme una foto de este mensaje."; exit 1; }
echo "✓ Número registrado."

echo "Suscribiendo la app a la cuenta de WhatsApp (para recibir los mensajes)…"
OUT=$(graph POST "$WABA/subscribed_apps") || { echo "$OUT"; echo "El número quedó registrado, pero falta la suscripción. Envíeme una foto de este mensaje."; exit 1; }
echo "✓ App suscrita."
echo
echo "LISTO. Pruebe escribiendo «Hola» desde otro celular a ese número."
echo "Si no responde, revise: journalctl -u mediconnect -n 30"
