// Carga en la base del servidor las promociones de config/promociones.txt (las que Gia muestra al preguntar por
// promociones) y agrega Podología (tomada de config/prosalud.json) si aún no existe. No toca los demás servicios: así no
// reaparece nada que se haya renombrado o quitado desde el panel.
// Uso:  node src/promos-cli.ts --db=/ruta/base.db
import { existsSync, readFileSync } from 'node:fs';
import { openDb, one, run, tx } from './db.ts';

const args = process.argv.slice(2);
const dbPath = args.find((a) => a.startsWith('--db='))?.slice(5) || 'data/prosalud.db';
if (!existsSync(dbPath)) { console.error(`No existe la base ${dbPath}.`); process.exit(1); }
const db = openDb(dbPath);
const clinic = one<{ id: number; name: string; settings: string }>(db, 'SELECT id, name, settings FROM clinics ORDER BY id LIMIT 1');
if (!clinic) { console.error('La base no tiene ninguna clínica.'); process.exit(1); }
const promos = readFileSync(new URL('../config/promociones.txt', import.meta.url), 'utf8').trim();
const cfg = JSON.parse(readFileSync(new URL('../config/prosalud.json', import.meta.url), 'utf8'));
const NUEVOS = ['Podología'];
const added: string[] = [];
tx(db, () => {
  const settings = JSON.parse(clinic.settings || '{}');
  settings.promotions = promos;
  run(db, 'UPDATE clinics SET settings = ? WHERE id = ?', JSON.stringify(settings), clinic.id);
  for (const s of cfg.specialties.filter((x: any) => NUEVOS.includes(x.name))) {
    if (one(db, 'SELECT id FROM specialties WHERE clinic_id = ? AND name = ?', clinic.id, s.name)) continue;
    const order = one<{ n: number | null }>(db, 'SELECT MAX(sort_order) n FROM specialties WHERE clinic_id = ?', clinic.id)?.n ?? 0;
    run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      clinic.id, s.name, s.description ?? null, s.price ?? null, s.kind ?? 'appointment', s.emoji ?? null, s.keywords ?? null, s.info ?? null, null, order + 1);
    added.push(s.name);
  }
});
console.log(`«${clinic.name}»: ${promos.split('\n').filter(Boolean).length} promociones cargadas para Gia.`);
console.log(added.length ? `Servicios nuevos: ${added.join(', ')}.` : 'No había servicios nuevos que agregar.');
