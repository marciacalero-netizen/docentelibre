import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, all, one } from '../src/db.ts';
import { handleIncoming } from '../src/agent/engine.ts';

const run = (db: string, ...a: string[]) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/setup-prosalud.ts', `--db=${db}`, ...a], { encoding: 'utf8' });

test('setup del piloto: crea Centro ProSalud con sus servicios y no pisa una base existente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'prosalud.db');
  try {
    assert.notEqual(run(path).status, 0);                                   // falta correo y nombre
    const r = run(path, 'admin@prosalud.test', 'Admin Prueba');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Contraseña temporal: \S{10,}/);
    const db = openDb(path);
    const c = one<any>(db, 'SELECT * FROM clinics');
    assert.equal(c.name, 'Centro ProSalud'); assert.equal(c.timezone, 'America/Guayaquil');
    assert.equal(JSON.parse(c.settings).assistant_name, 'SALUD');
    const sp = all<any>(db, 'SELECT name, kind FROM specialties ORDER BY id');
    assert.equal(sp.length, 12);
    assert.equal(sp.find((s) => s.name === 'Odontología').kind, 'handoff');
    for (const n of ['Laboratorio Clínico', 'Imágenes y Rayos X', 'Procedimientos Clínicos']) assert.equal(sp.find((s) => s.name === n).kind, 'handoff');
    assert.equal(all(db, 'SELECT id FROM specialties WHERE contact_whatsapp IS NOT NULL').length, 0);   // los números de cada área se cargan en el panel
    assert.equal(all(db, 'SELECT id FROM doctors').length, 0);              // los médicos se cargan en el panel
    assert.equal(one<any>(db, 'SELECT role FROM users').role, 'admin');
    // el agente funciona con la base recién creada
    const hola = handleIncoming(db, c.id, '+593990000999', 'Hola').replies[0];
    assert.match(hola, /Soy \*SALUD\*, el asistente virtual de \*Centro ProSalud\*/);
    assert.match(handleIncoming(db, c.id, '+593990000999', 'odontología').replies[0], /🦷 Odontolog[ií]a/);
    assert.match(handleIncoming(db, c.id, '+593990000998', 'mis resultados').replies[0], /no enviamos resultados por WhatsApp/);
    // Laboratorio: informa 7 a. m.–2 p. m. y recepción de pruebas hasta las 10 a. m.
    const lab = handleIncoming(db, c.id, '+593990000997', '¿atienden en el laboratorio?').replies[0];
    assert.match(lab, /7:00 a\. m\. a 2:00 p\. m\./); assert.match(lab, /hasta las 10:00 a\. m\./);
    // al cargar el WhatsApp del área, el agente deriva a ese número
    db.prepare("UPDATE specialties SET contact_whatsapp = '+593990000555' WHERE name = 'Laboratorio Clínico'").run();
    const ref = handleIncoming(db, c.id, '+593990000997', '1').replies[0];
    assert.match(ref, /https:\/\/wa\.me\/593990000555\?text=/);
    db.close();
    const again = run(path, 'otro@prosalud.test', 'Otro');
    assert.notEqual(again.status, 0); assert.match(again.stderr, /Ya existe una base con datos/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
