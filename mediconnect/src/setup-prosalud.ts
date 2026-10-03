// Crea la base de datos del piloto del Centro ProSalud a partir de config/prosalud.json.
// Uso:  npm run setup:prosalud -- correo@centro.com "Nombre del administrador"
// NUNCA borra una base existente: si ya hay datos, se detiene.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { openDb, one, run, tx } from './db.ts';
import { hashPassword } from './auth.ts';
import { DEFAULT_SETTINGS } from './services/clinic.ts';
import { nowIso } from './util.ts';

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
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDb(dbPath);
const password = randomBytes(9).toString('base64url');

tx(db, () => {
  const settings = { ...DEFAULT_SETTINGS, ...cfg.settings };
  const clinicId = Number(run(db, 'INSERT INTO clinics (name, slug, timezone, address, city, maps_url, settings, created_at) VALUES (?,?,?,?,?,?,?,?)',
    cfg.clinic.name, 'prosalud', cfg.clinic.timezone, cfg.clinic.address, cfg.clinic.city, cfg.clinic.maps_url || null, JSON.stringify(settings), nowIso()).lastInsertRowid);
  run(db, 'INSERT INTO users (clinic_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)', clinicId, adminName, email.toLowerCase(), hashPassword(password), 'admin', nowIso());
  for (const s of cfg.specialties) {
    run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info) VALUES (?,?,?,?,?,?,?,?)',
      clinicId, s.name, s.description ?? null, s.price ?? null, s.kind ?? 'appointment', s.emoji ?? null, s.keywords ?? null, s.info ?? null);
  }
});

console.log(`Base del piloto creada en ${dbPath}
Administrador: ${email}
Contraseña temporal: ${password}   (anótela ahora: no se vuelve a mostrar; cámbiela creando otro usuario si la pierde)

Siguiente paso: npm run start:prosalud   y complete en el panel:
  Médicos (con su horario semanal), precios, horario de recepción, guardia y usuarios de recepción.`);
