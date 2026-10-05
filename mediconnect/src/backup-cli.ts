// Copia de seguridad CONSISTENTE de la base de datos, incluso con MediConnect en funcionamiento.
// Uso:  node src/backup-cli.ts --db=data/prosalud.db --out=backups
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const arg = (k: string, d: string): string => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) || d;
const dbPath = arg('db', 'data/prosalud.db'), outDir = arg('out', 'backups');
if (!existsSync(dbPath)) { console.error(`No se encontró la base de datos en ${dbPath}`); process.exit(1); }
mkdirSync(outDir, { recursive: true });
const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
const target = join(outDir, `prosalud-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.db`);
const db = new DatabaseSync(dbPath, { readOnly: true });
try { db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`); } finally { db.close(); }
console.log(`Copia creada: ${target} (${Math.round(statSync(target).size / 1024)} KB)`);
