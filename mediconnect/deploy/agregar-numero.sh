#!/usr/bin/env bash
# Agrega un número a la cuenta de WhatsApp (WABA) usando la API de Meta, sin pasar por WhatsApp Manager:
# lo crea con su nombre visible, pide el código de verificación (SMS o llamada al chip) y lo verifica.
# Si Meta lo rechaza, muestra el error completo (código y detalle) para saber qué lo bloquea.
# Después: deploy/cambiar-numero.sh (para que Gia atienda ahí) y deploy/registrar-numero.sh (PIN).
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/agregar-numero.sh <WABA> <número sin 0 inicial, ej. 984166423> [Nombre visible]
set -euo pipefail
ENV="${MC_ENV:-/etc/mediconnect/mediconnect.env}"
[ -n "${MC_ENV:-}" ] || [ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
WABA="${1:-}"; NUM="${2:-}"; NAME="${3:-Prosalud}"
[[ "$WABA" =~ ^[0-9]{5,20}$ ]] && [[ "$NUM" =~ ^[1-9][0-9]{6,12}$ ]] || { echo "Uso: bash deploy/agregar-numero.sh <WABA> <número sin el 0 inicial, ej. 984166423> [Nombre visible]"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV."; exit 1; }
CC="${CC:-593}"

# Llamada a Meta: el token va por variable de entorno; los parámetros, como formulario.
graph() {   # graph MÉTODO RUTA [parámetros url-encoded]
  WA_TOKEN="$TOKEN" WA_METHOD="$1" WA_PATH="$2" WA_FORM="${3:-}" node --input-type=module -e '
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", base = e.WA_GRAPH_BASE || "https://graph.facebook.com";
let r; try {
  r = await fetch(`${base}/${v}/${e.WA_PATH}`, { method: e.WA_METHOD, headers: { Authorization: `Bearer ${e.WA_TOKEN}`, ...(e.WA_FORM ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) }, body: e.WA_FORM || undefined, signal: AbortSignal.timeout(30000) });
} catch (err) { console.log("✗ No se pudo contactar a Meta: " + (err.cause?.code ?? err.message)); process.exit(2); }
const b = await r.json().catch(() => ({}));
if (!r.ok) {
  const x = b.error ?? {};
  console.log("✗ Meta respondió:");
  for (const [k, l] of [["error_user_title", "Título"], ["error_user_msg", "Detalle"], ["message", "Mensaje"], ["code", "Código"], ["error_subcode", "Subcódigo"], ["fbtrace_id", "Referencia para soporte de Meta"]]) if (x[k]) console.log(`   ${l}: ${x[k]}`);
  process.exit(3);
}
console.log(JSON.stringify(b));'
}
enc() { node -e 'console.log(encodeURIComponent(process.argv[1]))' "$1"; }

echo "Se agregará +$CC $NUM con el nombre visible «$NAME» a la cuenta de WhatsApp $WABA."
read -rp "¿Continuar? (s/n): " OK
[[ "$OK" =~ ^[sS]$ ]] || { echo "Cancelado. No se cambió nada."; exit 1; }

echo "1/3  Agregando el número a la cuenta…"
OUT=$(graph POST "$WABA/phone_numbers" "cc=$CC&phone_number=$NUM&verified_name=$(enc "$NAME")") || { echo "$OUT"; echo; echo "El número NO se agregó. Envíeme una foto de este mensaje."; exit 1; }
PHONE_ID=$(printf '%s' "$OUT" | node -e 'console.log(JSON.parse(require("node:fs").readFileSync(0,"utf8")).id ?? "")')
[ -n "$PHONE_ID" ] || { echo "Meta no devolvió el identificador del número: $OUT"; exit 1; }
echo "   ✓ Número agregado (ID $PHONE_ID)."

read -rp "2/3  ¿Cómo enviar el código al chip? Escriba S para SMS o L para llamada: " M
[[ "$M" =~ ^[lL]$ ]] && METHOD=VOICE || METHOD=SMS
OUT=$(graph POST "$PHONE_ID/request_code" "code_method=$METHOD&language=es") || { echo "$OUT"; echo "No se pudo enviar el código. Envíeme una foto de este mensaje."; exit 1; }
echo "   ✓ Código enviado por $([ "$METHOD" = SMS ] && echo SMS || echo llamada) al +$CC $NUM."

while :; do
  read -rp "3/3  Escriba el código de 6 dígitos que llegó: " CODE; CODE=$(printf '%s' "$CODE" | tr -cd '0-9')
  [[ "$CODE" =~ ^[0-9]{6}$ ]] && break
  echo "   ✗ Deben ser 6 dígitos."
done
OUT=$(graph POST "$PHONE_ID/verify_code" "code=$CODE") || { echo "$OUT"; echo "El código no se aceptó. Puede volver a ejecutar este comando para pedir otro."; exit 1; }
echo "   ✓ Número verificado."
echo
echo "LISTO. Ahora ejecute:"
echo "  bash deploy/cambiar-numero.sh $WABA      (elija +$CC $NUM)"
echo "  bash deploy/registrar-numero.sh $WABA    (elija un PIN nuevo y anótelo)"
