import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, all, one } from '../src/db.ts';
import { handleIncoming } from '../src/agent/engine.ts';
import { normalizePhone } from '../src/util.ts';

const run = (db: string, ...a: string[]) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/setup-prosalud.ts', `--db=${db}`, `--local=${join(tmpdir(), 'no-existe-prosalud.local.json')}`, ...a], { encoding: 'utf8' });

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
    assert.equal(JSON.parse(c.settings).assistant_name, 'MediConnect');
    const sp = all<any>(db, 'SELECT name, kind FROM specialties ORDER BY id');
    assert.equal(sp.length, 12);
    assert.equal(sp.find((s) => s.name === 'Odontología').kind, 'handoff');
    for (const n of ['Laboratorio Clínico', 'Imágenes y Rayos X', 'Procedimientos Clínicos']) assert.equal(sp.find((s) => s.name === n).kind, 'handoff');
    assert.equal(all(db, 'SELECT id FROM specialties WHERE contact_whatsapp IS NOT NULL').length, 0);   // los números de cada área se cargan en el panel
    assert.equal(all(db, 'SELECT id FROM doctors').length, 0);              // los médicos se cargan en el panel
    assert.equal(one<any>(db, 'SELECT role FROM users').role, 'admin');
    // el agente funciona con la base recién creada
    const hola = handleIncoming(db, c.id, '+593990000999', 'Hola').replies[0];
    assert.match(hola, /Soy \*MediConnect\*, el asistente virtual de \*Centro ProSalud\*/);
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

test('teléfonos de Ecuador: se normalizan a formato internacional', () => {
  assert.equal(normalizePhone('0991234567'), '+593991234567');
  assert.equal(normalizePhone('099 123 4567'), '+593991234567');
  assert.equal(normalizePhone('593991234567'), '+593991234567');
  assert.equal(normalizePhone('+593 99 123 4567'), '+593991234567');
  assert.equal(normalizePhone('abc'), null); assert.equal(normalizePhone('123'), null);
});

test('setup del piloto: horario de recepción (lunes a sábado 8–18) y teléfonos desde el archivo local', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db'), local = join(dir, 'local.json');
  try {
    writeFileSync(local, JSON.stringify({ settings: { oncall_name: 'Guardia', oncall_whatsapp: '0999000111' }, specialty_contacts: { 'Odontología': '0990000222', 'Laboratorio Clínico': '0990000333', 'Imágenes y Rayos X': '0990000333' } }));
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/setup-prosalud.ts', `--db=${path}`, `--local=${local}`, 'a@b.co', 'Admin'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const db = openDb(path);
    const st = JSON.parse(one<any>(db, 'SELECT settings FROM clinics').settings);
    assert.deepEqual([1, 2, 3, 4, 5, 6].map((d) => st.hours[d]), Array(6).fill([['08:00', '18:00']]));
    assert.deepEqual(st.hours[0], []);                                     // domingo cerrado
    assert.equal(st.oncall_whatsapp, '+593999000111');
    const c = Object.fromEntries(all<any>(db, 'SELECT name, contact_whatsapp c FROM specialties').map((s) => [s.name, s.c]));
    assert.equal(c['Odontología'], '+593990000222'); assert.equal(c['Laboratorio Clínico'], '+593990000333'); assert.equal(c['Imágenes y Rayos X'], '+593990000333');
    assert.equal(c['Procedimientos Clínicos'], null);                      // sin WhatsApp propio: pasa a una persona de ProSalud
    // con recepción abierta (lunes 10:00) el agente deriva al número de Odontología; fuera de horario también (es un enlace)
    handleIncoming(db, 1, '+593990000001', 'dentista', { now: '2026-10-05T10:00' });
    assert.match(handleIncoming(db, 1, '+593990000001', '1', { now: '2026-10-05T10:00' }).replies[0], /wa\.me\/593990000222/);
    // un servicio inexistente o un teléfono inválido detienen el setup sin crear datos
    writeFileSync(local, JSON.stringify({ specialty_contacts: { 'Inventado': '0990000222' } }));
    assert.notEqual(spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/setup-prosalud.ts', `--db=${join(dir, 'x.db')}`, `--local=${local}`, 'a@b.co', 'Admin'], { encoding: 'utf8' }).status, 0);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
