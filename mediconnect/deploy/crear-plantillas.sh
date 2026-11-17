#!/usr/bin/env bash
# Crea en Meta las dos plantillas de WhatsApp que usa MediConnect (recordatorio de cita y encuesta de satisfacción),
# muestra su estado de revisión y, cuando Meta las aprueba, deja sus nombres guardados en el panel
# (Configuración → Mensajes automáticos). Se puede ejecutar las veces que haga falta: si una plantilla ya existe,
# no se vuelve a crear, solo se consulta su estado.
# El token se lee de /etc/mediconnect/mediconnect.env y nunca se muestra.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/crear-plantillas.sh <id-de-la-cuenta-de-WhatsApp-WABA>
set -euo pipefail
ENV="${MC_ENV:-/etc/mediconnect/mediconnect.env}"
DB="${MC_DB:-/var/lib/mediconnect/prosalud.db}"
[ -n "${MC_ENV:-}" ] || [ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
WABA="${1:-}"
[[ "$WABA" =~ ^[0-9]{5,20}$ ]] || { echo "Uso: bash deploy/crear-plantillas.sh <id-de-la-cuenta-de-WhatsApp (WABA), solo dígitos>"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV. Ejecute primero deploy/configurar-whatsapp.sh."; exit 1; }
[ -f "$DB" ] || { echo "No se encontró la base de datos $DB."; exit 1; }

# Todo el trabajo lo hace Node (sin dependencias). El token viaja por variable de entorno, nunca en la línea de comandos.
WA_TOKEN="$TOKEN" WA_WABA="$WABA" WA_DB="$DB" node --disable-warning=ExperimentalWarning --input-type=module -e '
import { DatabaseSync } from "node:sqlite";
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", base = e.WA_GRAPH_BASE || "https://graph.facebook.com";
const LANG = "es";
// Mismo texto y mismo orden de variables que usa el servidor (src/services/reminders.ts y surveys.ts). Ver docs/PLANTILLAS_WHATSAPP.md.
const TEMPLATES = [
  { key: "reminder", name: "recordatorio_cita", label: "Recordatorio de cita",
    text: "Hola, le recordamos la cita de {{1}} ({{2}}) en {{3}} el {{4}}. Responda CONFIRMO para confirmar, REAGENDAR para cambiarla o CANCELAR para anularla.",
    example: ["María Pérez", "Ginecología", "Centro ProSalud", "martes 15 de octubre, 09:00"] },
  { key: "survey", name: "encuesta_atencion", label: "Encuesta de satisfacción",
    text: "Hola, gracias por visitarnos en {{1}}. ¿Cómo calificaría la atención recibida en su cita de {{2}}? Responda con un número del 1 (muy mala) al 5 (excelente).",
    example: ["Centro ProSalud", "Ginecología"] },
];
const ESTADO = { APPROVED: "✅ Aprobada", PENDING: "⏳ En revisión", IN_APPEAL: "⏳ En apelación", REJECTED: "❌ Rechazada", PAUSED: "⏸️ Pausada", DISABLED: "⛔ Desactivada", LIMIT_EXCEEDED: "⛔ Límite excedido" };
const CATEGORIA = { UTILITY: "Utilidad", MARKETING: "Marketing", AUTHENTICATION: "Autenticación" };

async function graph(method, path, body) {
  let r;
  try {
    r = await fetch(`${base}/${v}/${path}`, { method, headers: { Authorization: `Bearer ${e.WA_TOKEN}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  } catch (err) { throw new Error("No se pudo contactar a Meta: " + (err.cause?.code ?? err.message)); }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const x = b.error ?? {};
    const perm = x.code === 200 || x.code === 10 || /permission/i.test(x.message ?? "");
    throw new Error(`Meta respondió: ${x.error_user_msg || x.message || "sin detalle"}${x.code ? ` (código ${x.code}${x.error_subcode ? "/" + x.error_subcode : ""})` : ""}` +
      (perm ? "\n   → El token no tiene el permiso «whatsapp_business_management». Envíeme una foto de este mensaje." : ""));
  }
  return b;
}
const find = async (name) => (await graph("GET", `${e.WA_WABA}/message_templates?name=${name}&fields=name,status,language,category,rejected_reason&limit=50`)).data?.filter((t) => t.name === name) ?? [];

const approved = {};
let problems = 0;
for (const t of TEMPLATES) {
  console.log(`\n▶ ${t.label}  (${t.name})`);
  try {
    let found = await find(t.name);
    if (!found.length) {
      console.log("   No existe todavía: enviándola a Meta para revisión…");
      await graph("POST", `${e.WA_WABA}/message_templates`, { name: t.name, language: LANG, category: "UTILITY", components: [{ type: "BODY", text: t.text, example: { body_text: [t.example] } }] });
      found = await find(t.name);
    }
    for (const f of found) {
      console.log(`   Estado: ${ESTADO[f.status] ?? f.status} · categoría: ${CATEGORIA[f.category] ?? f.category} · idioma: ${f.language}`);
      if (f.status === "REJECTED" && f.rejected_reason && f.rejected_reason !== "NONE") console.log(`   Motivo del rechazo: ${f.rejected_reason}`);
      if (f.category === "MARKETING") console.log("   Nota: Meta la clasificó como Marketing (tarifa distinta a Utilidad).");
      if (f.status === "APPROVED" && !approved[t.key]) approved[t.key] = f.language;
      if (f.status === "REJECTED") problems++;
    }
  } catch (err) { problems++; console.log("   ✗ " + err.message); }
}

// Guardar en el panel solo las plantillas aprobadas (el servidor lee la configuración en cada envío: no hace falta reiniciar).
const names = Object.keys(approved);
if (names.length) {
  const db = new DatabaseSync(e.WA_DB);
  const row = db.prepare("SELECT id, settings FROM clinics ORDER BY id LIMIT 1").get();
  const s = JSON.parse(row.settings || "{}");
  const wt = { reminder: "", survey: "", language: LANG, ...(s.wa_templates ?? {}) };
  for (const t of TEMPLATES) if (approved[t.key]) { wt[t.key] = t.name; wt.language = approved[t.key]; }
  s.wa_templates = wt;
  db.prepare("UPDATE clinics SET settings = ? WHERE id = ?").run(JSON.stringify(s), row.id);
  console.log(`\n✓ Guardado en el panel (Configuración → Mensajes automáticos): ${TEMPLATES.filter((t) => approved[t.key]).map((t) => t.name).join(", ")}.`);
}
const pending = TEMPLATES.filter((t) => !approved[t.key]);
if (!pending.length) console.log("\nLISTO. Las dos plantillas están aprobadas y configuradas.");
else if (!problems) console.log("\nFalta la aprobación de Meta (suele tardar de minutos a unas horas). Vuelva a ejecutar este mismo comando más tarde para revisar.");
else { console.log("\nHubo un problema. Envíeme una foto de esta pantalla."); process.exitCode = 1; }
'
