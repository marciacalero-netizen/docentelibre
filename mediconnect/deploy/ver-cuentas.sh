#!/usr/bin/env bash
# Solo lectura: lista las cuentas de WhatsApp (WABA) que el token puede ver y sus números, para encontrar
# en cuál está un número que Meta dice «already in use». No cambia ni borra nada.
# Uso (como root):  bash /opt/mediconnect/mediconnect/deploy/ver-cuentas.sh <business_id> [<business_id> ...] [--buscar 984166423]
set -euo pipefail
ENV="${MC_ENV:-/etc/mediconnect/mediconnect.env}"
[ -n "${MC_ENV:-}" ] || [ "$(id -u)" = 0 ] || { echo "Ejecute como root."; exit 1; }
[ $# -ge 1 ] || { echo "Uso: bash deploy/ver-cuentas.sh <id-del-negocio> [otros ids] [--buscar 984166423]"; exit 1; }
TOKEN=$(grep -E '^WHATSAPP_TOKEN=.+' "$ENV" | cut -d= -f2- || true)
[ -n "$TOKEN" ] || { echo "No hay WHATSAPP_TOKEN en $ENV."; exit 1; }

WA_TOKEN="$TOKEN" node --input-type=module -e '
const e = process.env, v = e.WHATSAPP_API_VERSION || "v21.0", base = e.WA_GRAPH_BASE || "https://graph.facebook.com";
const args = process.argv.slice(1); const i = args.indexOf("--buscar");
const buscar = i >= 0 ? (args[i + 1] || "").replace(/\D/g, "") : "";
const ids = args.filter((a, k) => /^\d{5,20}$/.test(a) && !(i >= 0 && k === i + 1));
async function get(path) {
  try {
    const r = await fetch(`${base}/${v}/${path}`, { headers: { Authorization: `Bearer ${e.WA_TOKEN}` }, signal: AbortSignal.timeout(30000) });
    const b = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, b } : { ok: false, err: `${b.error?.message ?? "sin detalle"}${b.error?.code ? ` (código ${b.error.code})` : ""}` };
  } catch (err) { return { ok: false, err: "No se pudo contactar a Meta: " + (err.cause?.code ?? err.message) }; }
}
const vistas = new Set(); let hallado = false;
for (const biz of ids) {
  console.log(`\n=== Negocio ${biz} ===`);
  for (const [tipo, edge] of [["propias", "owned_whatsapp_business_accounts"], ["compartidas con el negocio", "client_whatsapp_business_accounts"]]) {
    const r = await get(`${biz}/${edge}?fields=id,name&limit=100`);
    if (!r.ok) { console.log(`  (cuentas ${tipo}: no se pudieron leer — ${r.err})`); continue; }
    const list = r.b.data ?? [];
    if (!list.length) { console.log(`  Cuentas ${tipo}: ninguna`); continue; }
    console.log(`  Cuentas ${tipo}:`);
    for (const w of list) {
      if (vistas.has(w.id)) { console.log(`   • ${w.name} (ID ${w.id}) — ya listada`); continue; }
      vistas.add(w.id);
      console.log(`   • ${w.name} (ID ${w.id})`);
      const p = await get(`${w.id}/phone_numbers?fields=display_phone_number,verified_name,status,platform_type&limit=100`);
      if (!p.ok) { console.log(`       números: no se pudieron leer — ${p.err}`); continue; }
      const nums = p.b.data ?? [];
      if (!nums.length) console.log("       (sin números)");
      for (const n of nums) {
        const match = buscar && (n.display_phone_number || "").replace(/\D/g, "").endsWith(buscar);
        if (match) hallado = true;
        console.log(`       ${match ? "👉 " : "- "}${n.display_phone_number} · ${n.verified_name ?? ""} · estado: ${n.status ?? "?"}${n.platform_type ? ` · ${n.platform_type}` : ""}`);
      }
    }
  }
}
if (buscar) console.log(hallado ? `\nEl número ${buscar} está marcado con 👉. NO borre nada: envíeme una foto.` : `\nEl número ${buscar} no aparece en ninguna cuenta que este token pueda ver.`);
' "$@"
