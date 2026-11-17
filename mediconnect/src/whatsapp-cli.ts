// Asocia el número de WhatsApp (phone_number_id de Meta) con la clínica del piloto.
// Uso:  npm run whatsapp:phone -- 123456789012345        (el ID lo muestra Meta en WhatsApp Manager → Números de teléfono)
// No es un secreto; los secretos (token, clave de la app) van SOLO en variables de entorno.
import { existsSync } from 'node:fs';
import { openDb, one, run } from './db.ts';

const args = process.argv.slice(2);
const dbPath = args.find((a) => a.startsWith('--db='))?.slice(5) || 'data/prosalud.db';
const id = args.filter((a) => !a.startsWith('--'))[0];
if (!id || !/^\d{5,20}$/.test(id)) { console.error('Uso: npm run whatsapp:phone -- <phone_number_id>   (solo dígitos, p. ej. 123456789012345)'); process.exit(1); }
if (!existsSync(dbPath)) { console.error(`No existe la base ${dbPath}. Cree primero el piloto con «npm run setup:prosalud».`); process.exit(1); }
const db = openDb(dbPath);
const clinic = one<{ id: number; name: string }>(db, 'SELECT id, name FROM clinics ORDER BY id LIMIT 1');
if (!clinic) { console.error('La base no tiene ninguna clínica.'); process.exit(1); }
try { run(db, 'UPDATE clinics SET whatsapp_phone_id = ? WHERE id = ?', id, clinic.id); }
catch { console.error('Ese phone_number_id ya está asignado a otra clínica.'); process.exit(1); }
console.log(`Listo: «${clinic.name}» quedó asociada al número de WhatsApp con ID ${id}.`);
