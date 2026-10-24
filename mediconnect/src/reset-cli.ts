// Borra los datos de pacientes (pruebas) y conserva la configuración. Ver src/services/reset.ts y deploy/borrar-pruebas.sh.
// Uso:  node src/reset-cli.ts --db=/ruta/base.db [--si]     (sin --si solo muestra cuánto se borraría)
import { existsSync } from 'node:fs';
import { openDb, one } from './db.ts';
import { patientDataCounts, resetPatientData } from './services/reset.ts';

const args = process.argv.slice(2);
const dbPath = args.find((a) => a.startsWith('--db='))?.slice(5) || 'data/prosalud.db';
if (!existsSync(dbPath)) { console.error(`No existe la base ${dbPath}.`); process.exit(1); }
const db = openDb(dbPath);
const clinic = one<{ id: number; name: string }>(db, 'SELECT id, name FROM clinics ORDER BY id LIMIT 1');
if (!clinic) { console.error('La base no tiene ninguna clínica.'); process.exit(1); }
const c = args.includes('--si') ? resetPatientData(db, clinic.id) : patientDataCounts(db, clinic.id);
console.log(`${args.includes('--si') ? 'Se borró' : 'Se borraría'} en «${clinic.name}»:
  Pacientes: ${c.patients}
  Conversaciones: ${c.conversations} (${c.messages} mensajes)
  Citas: ${c.appointments} (${c.calendar_events} en Google Calendar)
  Alertas: ${c.notifications}
  Encuestas: ${c.surveys}`);
