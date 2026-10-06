import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, all, one, run as dbRun } from '../src/db.ts';
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
    assert.equal(sp.length, 13);
    const kind = (n: string) => sp.find((x) => x.name === n).kind;
    for (const n of ['Odontología', 'Laboratorio Clínico', 'Imágenes y Rayos X', 'Procedimientos Clínicos', 'Optometría']) assert.equal(kind(n), 'handoff', n);
    for (const n of ['Medicina General', 'Pediatría', 'Ginecología', 'Dermatología', 'Cirugía Menor']) assert.equal(kind(n), 'walkin', n);   // «atención fija»: sin cita
    for (const n of ['Cardiología', 'Psicología', 'Traumatología']) assert.equal(kind(n), 'appointment', n);                                 // las que se agendan
    assert.equal(all(db, 'SELECT id FROM specialties WHERE contact_whatsapp IS NOT NULL').length, 0);   // los números de cada área se cargan en el panel
    // médicos y horarios del Excel de atención particular (citas de 60 min)
    assert.equal(all(db, 'SELECT id FROM doctors').length, 10);
    assert.deepEqual(all(db, 'SELECT DISTINCT slot_minutes s FROM doctors').map((r: any) => r.s), [60]);
    const sched = (doc: string, spec: string) => all<any>(db, `SELECT s.weekday d, s.start_time a, s.end_time b FROM schedules s JOIN doctors x ON x.id = s.doctor_id JOIN specialties p ON p.id = x.specialty_id WHERE x.name = ? AND p.name = ? ORDER BY s.weekday, s.start_time`, doc, spec).map((r) => ({ ...r }));
    assert.deepEqual(sched('Dr. Daniel Loor', 'Cardiología'), [{ d: 6, a: '08:00', b: '11:45' }]);
    assert.equal(sched('Dra. Gabriela Táquez', 'Traumatología').length, 6);
    assert.deepEqual(sched('Dra. Roxana Barreto', 'Medicina General').filter((r: any) => r.d === 1), [{ d: 1, a: '08:00', b: '13:00' }, { d: 1, a: '14:00', b: '18:00' }]);
    assert.equal(sched('Dra. Roxana Barreto', 'Dermatología').length, 0);                                // la Dra. Barreto atiende Dermatología sin horario propio
    assert.equal(one<any>(db, 'SELECT role FROM users').role, 'admin');
    assert.equal(one<any>(db, 'SELECT must_change FROM users').must_change, 1);   // la clave temporal obliga a crear una propia
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
    assert.match(ref, /https:\/\/wa\.me\/593990000555/);
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

test('piloto ProSalud: sin cita informa horarios; con cita agenda en bloques de 1 hora', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const talk = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x, { now: '2026-10-05T10:00' }).replies.join('\n'));
    // «Atención fija»: solo informa quién atiende y cuándo; no agenda
    const peds = talk('+593990020001', 'quiero una cita con el pediatra')[0];
    assert.match(peds, /Pediatría se atiende \*sin cita\*/); assert.match(peds, /Dra\. María Abreu\*: lun, mié, vie y sáb 08:30–11:00 · mar y jue 08:30–17:00/);
    const mg = talk('+593990020002', 'medicina general')[0];
    assert.match(mg, /Dra\. Roxana Barreto\*: lun–vie 08:00–13:00 y 14:00–18:00/);
    assert.match(mg, /Dr\. Anthony Mazzini\*: mié y vie 07:00–12:00/);
    assert.match(mg, /Hablar con recepción/);
    assert.equal(all(db, 'SELECT id FROM appointments').length, 0);
    // «médicos»: agrupa por profesional (la Dra. Barreto atiende cuatro servicios) y no confunde con Medicina General
    const docs = talk('+593990020003', 'médicos')[0];
    assert.match(docs, /Nuestros profesionales/);
    assert.match(docs, /\*Dra\. Roxana Barreto\*\n\s+– Medicina General \(sin cita\)[\s\S]*– Ginecología \(sin cita\): sáb 08:00–12:00[\s\S]*– Dermatología \(sin cita\): sin horario fijo[\s\S]*– Cirugía Menor \(sin cita\): sin horario fijo/);
    assert.equal((docs.match(/Dra\. Roxana Barreto/g) ?? []).length, 1);
    // con cita: Cardiología, Psicología y Traumatología; separadas de «Otros servicios»
    const list = talk('+593990020004', 'Hola', '4', 'si', '1', 'Ana Gil Mora')[4];
    const [citas, otros] = list.split('Otros servicios');
    for (const n of ['Cardiología', 'Psicología', 'Traumatología']) assert.match(citas, new RegExp(n));
    for (const n of ['Medicina General', 'Pediatría', 'Odontología', 'Laboratorio', 'Cirugía Menor', 'Dermatología']) { assert.match(otros, new RegExp(n)); assert.doesNotMatch(citas, new RegExp(n)); }
    // Traumatología 8:00–11:30 con citas de 60 min: solo caben 8:00, 9:00 y 10:00
    const slots = talk('+593990020004', 'traumatologia')[0];
    const times = [...slots.matchAll(/\*\d\.\* \S+ \d+ de \S+, (\d\d:\d\d)/g)].map((m) => m[1]);
    assert.ok(times.length >= 3 && times.every((t) => ['08:00', '09:00', '10:00'].includes(t)), times.join(','));
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Dermatología: la atiende la Dra. Barreto sin cita y sin horario propio', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const say = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x).replies.join('\n'));
    const [msg] = say('+593990030001', 'quiero una cita con dermatología');
    assert.match(msg, /Dra\. Roxana Barreto\*, \*sin cita\*, dentro de su horario de Medicina General/);
    assert.match(msg, /no tiene un horario fijo/); assert.match(msg, /\*1\.\* Hablar con recepción/);
    assert.doesNotMatch(msg, /cita previa/);
    assert.match(say('+593990030001', '1')[0], /recepci[oó]n/i);
    assert.equal(all(db, 'SELECT id FROM appointments').length, 0);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('servicio con cita sin médico activo (p. ej. se fue el especialista): avisa, deriva a recepción y se agenda solo al cargar a uno nuevo', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const say = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x).replies.join('\n'));
    // Traumatología se queda sin médico
    dbRun(db, `UPDATE doctors SET active = 0 WHERE specialty_id = (SELECT id FROM specialties WHERE name = 'Traumatología')`);
    const [msg] = say('+593990030011', 'quiero una cita con traumatología');
    assert.match(msg, /Traumatología se atiende con \*cita previa\*, pero todavía estamos confirmando al profesional/);
    assert.match(msg, /\*1\.\* Hablar con recepción/);
    say('+593990030011', '1');
    assert.match(one<any>(db, `SELECT handoff_reason FROM conversations WHERE patient_phone='+593990030011'`).handoff_reason, /Traumatología \(aún sin profesional cargado\)/);
    assert.match(say('+593990030012', 'Hola', '1')[1], /Traumatología — _próximamente_/);
    const list = say('+593990030013', 'Hola', '4', 'si', '1', 'Luis Mora Paz')[4];
    assert.doesNotMatch(list.split('Otros servicios')[0], /Traumatología/);
    // llega un médico nuevo: se agrega desde el panel (aquí por SQL) y vuelve a agendarse sin tocar nada más
    const spec = one<any>(db, `SELECT id FROM specialties WHERE name = 'Traumatología'`).id;
    const doc = Number(dbRun(db, `INSERT INTO doctors (clinic_id, specialty_id, name, slot_minutes) VALUES (?,?,?,60)`, cid, spec, 'Dr. Nuevo Traumatólogo').lastInsertRowid);
    for (const d of [1, 2, 3, 4, 5, 6]) dbRun(db, `INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)`, cid, doc, d, '08:00', '12:00');
    const list2 = say('+593990030014', 'Hola', '4', 'si', '1', 'Luis Mora Paz')[4];
    assert.match(list2.split('Otros servicios')[0], /Traumatología/);
    assert.match(say('+593990030014', 'traumatologia')[0], /Estos son los próximos horarios disponibles con Dr\. Nuevo Traumatólogo/);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('copia de seguridad: copia consistente de la base aunque esté en uso', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db'), out = join(dir, 'backups');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const live = openDb(path);   // base abierta, como cuando el sistema está funcionando
    dbRun(live, `INSERT INTO patients (clinic_id, phone, name, created_at) VALUES (1, '+593990040001', 'Paciente Respaldo', '2026-01-01')`);
    const r = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/backup-cli.ts', `--db=${path}`, `--out=${out}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /Copia creada: .*prosalud-\d{8}-\d{6}\.db/);
    const file = r.stdout.match(/Copia creada: (.*\.db)/)![1];
    const copy = openDb(file);
    assert.equal(one<any>(copy, `SELECT name FROM patients WHERE phone = '+593990040001'`).name, 'Paciente Respaldo');
    assert.equal(all(copy, 'SELECT id FROM doctors').length, 10);
    copy.close(); live.close();
    assert.notEqual(spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/backup-cli.ts', `--db=${join(dir, 'no.db')}`, `--out=${out}`], { encoding: 'utf8' }).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
