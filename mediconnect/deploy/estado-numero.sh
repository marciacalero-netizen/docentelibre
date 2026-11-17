#!/usr/bin/env bash
# Solo lectura: muestra lo que Meta sabe de un número (verificación, estado, nombre). No pide códigos ni cambia nada.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/estado-numero.sh <ID-del-número>
set -euo pipefail
ENV="${MC_ENV:-/etc/mediconnect/mediconnect.env}"
[ -n "${MC_ENV:-}" ] || [ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
PHONE_ID="${1:-}"
[[ "$PHONE_ID" =~ ^[0-9]{5,20}$ ]] || { echo "Uso: bash deploy/estado-numero.sh <ID del número>"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV."; exit 1; }
WA_TOKEN="$TOKEN" WA_ID="$PHONE_ID" node --input-type=module -e '
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", base = e.WA_GRAPH_BASE || "https://graph.facebook.com";
const f = "display_phone_number,verified_name,name_status,new_name_status,code_verification_status,status,quality_rating,platform_type,account_mode";
let r; try { r = await fetch(`${base}/${v}/${e.WA_ID}?fields=${f}`, { headers: { Authorization: `Bearer ${e.WA_TOKEN}` }, signal: AbortSignal.timeout(30000) }); }
catch (err) { console.log("✗ No se pudo contactar a Meta: " + (err.cause?.code ?? err.message)); process.exit(2); }
const b = await r.json().catch(() => ({}));
if (!r.ok) { console.log(`✗ Meta respondió: ${b.error?.message ?? "sin detalle"}`); process.exit(3); }
const VER = { VERIFIED: "✅ VERIFICADO", NOT_VERIFIED: "❌ sin verificar", EXPIRED: "⌛ verificación vencida" };
console.log(`Número:        ${b.display_phone_number}`);
console.log(`Nombre:        ${b.verified_name ?? "?"} (revisión: ${b.name_status ?? "?"}${b.new_name_status ? ", nuevo: " + b.new_name_status : ""})`);
console.log(`Verificación:  ${VER[b.code_verification_status] ?? b.code_verification_status ?? "?"}`);
console.log(`Estado:        ${b.status ?? "?"}   Plataforma: ${b.platform_type ?? "?"}   Modo: ${b.account_mode ?? "?"}`);
if (b.code_verification_status === "VERIFIED") console.log("\n→ Ya está verificado: puede seguir con cambiar-numero.sh y registrar-numero.sh (no hace falta otro código).");'
