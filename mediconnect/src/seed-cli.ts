import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from './db.ts';
import { DEMO_PASSWORD, seedDemo } from './seed.ts';

const path = process.env.MEDICONNECT_DB ?? new URL('../data/mediconnect.db', import.meta.url).pathname;
mkdirSync(dirname(path), { recursive: true });
for (const ext of ['', '-wal', '-shm']) if (existsSync(path + ext)) rmSync(path + ext);
const db = openDb(path);
seedDemo(db);
console.log(`Base de datos demo creada en ${path}\nUsuarios: admin@santalucia.demo, recepcion@santalucia.demo, admin@medisur.demo — contraseña: ${DEMO_PASSWORD}`);
