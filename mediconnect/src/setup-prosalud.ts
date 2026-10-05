// Crea la base de datos del piloto del Centro ProSalud a partir de config/prosalud.json.
// Uso:  npm run setup:prosalud -- correo@centro.com "Nombre del administrador"
// NUNCA borra una base existente: si ya hay datos, se detiene.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { openDb, one, run, tx } from './db.ts';
import { hashPassword } from './auth.ts';
import { DEFAULT_SETTINGS } from './services/clinic.ts';
import { normalizePhone, nowIso } from './util.ts';

const args = process.argv.slice(2);
const dbPath = args.find((a) => a.startsWith('--db='))?.slice(5) || 'data/prosalud.db';
const [email, adminName] = args.filter((a) => !a.startsWith('--'));
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !adminName) {
  console.error('Uso: npm run setup:prosalud -- correo@centro.com "Nombre del administrador"');
  process.exit(1);
}
if (existsSync(dbPath) && statSync(dbPath).size > 0) {
  const db = openDb(dbPath);
  if (one(db, 'SELECT id FROM clinics LIMIT 1')) {
    console.error(`Ya existe una base con datos en ${dbPath}. No se modifica. (Para empezar de cero, mueva o respalde ese archivo manualmente.)`);
    process.exit(1);
  }
}
const cfg = JSON.parse(readFileSync(new URL('../config/prosalud.json', import.meta.url), 'utf8'));
// Datos privados (teléfonos): config/prosalud.local.json, ignorado por Git. Formato en prosalud.local.example.json.
const localPath = args.find((a) => a.startsWith('--local='))?.slice(8) ?? fileURLToPath(new URL('../config/prosalud.local.json', import.meta.url));
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
const fixPhone = (v: string, what: string): string => { const p = normalizePhone(v); if (!p) { console.error(`Teléfono inválido para ${what}: «${v}»`); process.exit(1); } return p; };
if (local.settings?.oncall_whatsapp) local.settings.oncall_whatsapp = fixPhone(local.settings.oncall_whatsapp, 'la guardia');
for (const [name, num] of Object.entries<string>(local.specialty_contacts ?? {})) {
  const s = cfg.specialties.find((x: any) => x.name === name);
  if (!s) { console.error(`El servicio «${name}» de prosalud.local.json no existe en prosalud.json`); process.exit(1); }
  s.contact_whatsapp = fixPhone(num, name);
}
Object.assign(cfg.settings, local.settings ?? {});
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
const password = randomBytes(9).toString('base64url');

tx(db, () => {
  const settings = { ...DEFAULT_SETTINGS, ...cfg.settings };
  const clinicId = Number(run(db, 'INSERT INTO clinics (name, slug, timezone, address, city, maps_url, settings, created_at) VALUES (?,?,?,?,?,?,?,?)',
    cfg.clinic.name, 'prosalud', cfg.clinic.timezone, cfg.clinic.address, cfg.clinic.city, cfg.clinic.maps_url || null, JSON.stringify(settings), nowIso()).lastInsertRowid);
  run(db, 'INSERT INTO users (clinic_id, name, email, password_hash, role, must_change, created_at) VALUES (?,?,?,?,?,1,?)', clinicId, adminName, email.toLowerCase(), hashPassword(password), 'admin', nowIso());
  const spIds = new Map<string, number>();
  for (const s of cfg.specialties) {
    const r = run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp) VALUES (?,?,?,?,?,?,?,?,?)',
      clinicId, s.name, s.description ?? null, s.price ?? null, s.kind ?? 'appointment', s.emoji ?? null, s.keywords ?? null, s.info ?? null, s.contact_whatsapp || null);
    spIds.set(s.name, Number(r.lastInsertRowid));
  }
  // Médicos y horarios semanales (un profesional que atiende varias especialidades tiene una fila por especialidad)
  for (const d of cfg.doctors ?? []) {
    const spId = spIds.get(d.specialty);
    if (!spId) { console.error(`El médico «${d.name}» usa una especialidad que no existe: ${d.specialty}`); process.exit(1); }
    const docId = Number(run(db, 'INSERT INTO doctors (clinic_id, specialty_id, name, slot_minutes) VALUES (?,?,?,?)', clinicId, spId, d.name, d.slot_minutes ?? 30).lastInsertRowid);
    for (const b of d.schedule ?? []) for (const day of b.days) run(db, 'INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)', clinicId, docId, day, b.start, b.end);
  }
});

console.log(`Base del piloto creada en ${dbPath}
Administrador: ${email}
Contraseña temporal: ${password}   (anótela ahora: no se vuelve a mostrar). Al ingresar por primera vez, el panel pedirá crear una contraseña propia.

Teléfonos cargados desde ${existsSync(localPath) ? 'prosalud.local.json' : '— (no hay prosalud.local.json: cárguelos desde el panel)'}.

Médicos cargados: ${(cfg.doctors ?? []).length} (desde config/prosalud.json).

Siguiente paso: npm run start:prosalud   y complete en el panel: precios y usuarios de recepción.`);
