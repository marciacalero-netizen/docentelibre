#!/usr/bin/env bash
# Muestra y actualiza el perfil de empresa de WhatsApp del número de Gia (descripción, dirección, correo, enlaces,
# categoría y la frase «Info»). Primero muestra lo que Meta tiene guardado; solo cambia algo si usted confirma.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/perfil-whatsapp.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
ENV=/etc/mediconnect/mediconnect.env
DB=/var/lib/mediconnect/prosalud.db
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV."; exit 1; }
PHONE_ID=$(node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
console.log(new DatabaseSync(process.argv[1], { readOnly: true }).prepare("SELECT whatsapp_phone_id AS id FROM clinics ORDER BY id LIMIT 1").get()?.id ?? "");' "$DB")
[ -n "$PHONE_ID" ] || { echo "La clínica no tiene número de WhatsApp asociado."; exit 1; }

# ── Texto del perfil (edítelo aquí si quiere cambiarlo) ──
ABOUT='Agende su cita con Gia las 24 horas 🩺'
DESCRIPTION='Centro médico de especialidades en Guayaquil: medicina general, ecografía, pediatría, ginecología, odontología, cardiología y más. Agende su cita con Gia, nuestra asistente virtual, las 24 horas. Atención: lunes a viernes 08:00–18:00, sábados 08:00–12:00.'
ADDRESS='Cdla. Las Orquídeas, Mz. 1043, Solar 37, frente a Taurus Gym, Guayaquil, Ecuador'
EMAIL="${PERFIL_EMAIL:-cprosaludsa@gmail.com}"
WEB1='https://prosalud.mediconnectec.com'
WEB2='https://www.instagram.com/prosaludcentro'

WA_TOKEN="$TOKEN" WA_ID="$PHONE_ID" A="$ABOUT" D="$DESCRIPTION" AD="$ADDRESS" E="$EMAIL" W1="$WEB1" W2="$WEB2" node --input-type=module -e '
import { createInterface } from "node:readline/promises";
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", url = `https://graph.facebook.com/${v}/${e.WA_ID}/whatsapp_business_profile`;
const H = { Authorization: `Bearer ${e.WA_TOKEN}`, "Content-Type": "application/json" };
const show = (p) => { for (const [k, l] of [["about","Info (frase corta)"],["description","Descripción"],["address","Dirección"],["email","Correo"],["websites","Enlaces"],["vertical","Categoría"]]) console.log(`  ${l}: ${Array.isArray(p[k]) ? p[k].join("  |  ") : (p[k] || "(vacío)")}`); };
const get = async () => { const r = await fetch(url + "?fields=about,address,description,email,websites,vertical", { headers: H }); const b = await r.json(); if (!r.ok) throw new Error(b.error?.message ?? r.status); return b.data?.[0] ?? {}; };
try {
  console.log("Lo que Meta tiene guardado ahora:"); show(await get());
  const nuevo = { about: e.A, description: e.D, address: e.AD, email: e.E, websites: [e.W1, e.W2], vertical: "HEALTH" };
  console.log("\nSe guardará:"); show(nuevo);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ok = (await rl.question("\n¿Guardar estos datos en el perfil? (s/n): ")).trim().toLowerCase(); rl.close();
  if (ok !== "s") { console.log("Cancelado. No se cambió nada."); process.exit(0); }
  const r = await fetch(url, { method: "POST", headers: H, body: JSON.stringify({ messaging_product: "whatsapp", ...nuevo }) });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { console.log(`✗ Meta respondió: ${b.error?.error_user_msg || b.error?.message || r.status}`); process.exit(1); }
  console.log("\n✓ Perfil guardado. Ahora Meta tiene:"); show(await get());
  console.log("\nLos celulares de los pacientes pueden tardar desde unas horas hasta unos días en mostrar el perfil nuevo.");
} catch (err) { console.log("✗ No se pudo leer o guardar el perfil: " + err.message); process.exit(1); }'
