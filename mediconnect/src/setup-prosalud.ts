// Crea la base de datos del piloto del Centro ProSalud a partir de config/prosalud.json.
// Uso:  npm run setup:prosalud -- correo@centro.com "Nombre del administrador"
// NUNCA borra una base existente: si ya hay datos, se detiene.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
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
const localPath = args.find((a) => a.startsWith('--local='))?.slice(8) ?? new URL('../config/prosalud.local.json', import.meta.url).pathname;
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
  run(db, 'INSERT INTO users (clinic_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)', clinicId, adminName, email.toLowerCase(), hashPassword(password), 'admin', nowIso());
  for (const s of cfg.specialties) {
    run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp) VALUES (?,?,?,?,?,?,?,?,?)',
      clinicId, s.name, s.description ?? null, s.price ?? null, s.kind ?? 'appointment', s.emoji ?? null, s.keywords ?? null, s.info ?? null, s.contact_whatsapp || null);
  }
});

console.log(`Base del piloto creada en ${dbPath}
Administrador: ${email}
Contraseña temporal: ${password}   (anótela ahora: no se vuelve a mostrar; cámbiela creando otro usuario si la pierde)

Teléfonos cargados desde ${existsSync(localPath) ? 'prosalud.local.json' : '— (no hay prosalud.local.json: cárguelos desde el panel)'}.

Siguiente paso: npm run start:prosalud   y complete en el panel:
  Médicos (con su horario semanal), precios y usuarios de recepción.`);
