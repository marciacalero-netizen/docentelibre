import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, all, one, run as dbRun } from '../src/db.ts';
import { handleIncoming } from '../src/agent/engine.ts';
import { normalizePhone } from '../src/util.ts';
import { getClinic } from '../src/services/clinic.ts';
import { runRemindersForClinic } from '../src/services/reminders.ts';

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
    assert.equal(sp.length, 14);
    const kind = (n: string) => sp.find((x) => x.name === n).kind;
    for (const n of ['Odontología', 'Laboratorio Clínico', 'Imágenes y Rayos X', 'Procedimientos Clínicos', 'Cirugía Menor']) assert.equal(kind(n), 'handoff', n);
    assert.equal(kind('Medicina General'), 'walkin');   // Medicina General: sin cita, por orden de llegada   // «atención fija»: sin cita
    for (const n of ['Cardiología', 'Psicología', 'Traumatología', 'Otorrinolaringología', 'Pediatría', 'Ginecología', 'Dermatología', 'Optometría']) assert.equal(kind(n), 'appointment', n);                                 // las que se agendan
    assert.equal(all(db, 'SELECT id FROM specialties WHERE contact_whatsapp IS NOT NULL').length, 0);   // los números de cada área se cargan en el panel
    // médicos y horarios del Excel de atención particular (citas de 45 min)
    assert.equal(all(db, 'SELECT id FROM doctors').length, 10);   // la Dra. Barreto deja Medicina General; la Dra. Abreu suma Otorrinolaringología; se suma el optometrista
    assert.deepEqual(all(db, 'SELECT DISTINCT slot_minutes s FROM doctors').map((r: any) => r.s), [45]);
    const sched = (doc: string, spec: string) => all<any>(db, `SELECT s.weekday d, s.start_time a, s.end_time b FROM schedules s JOIN doctors x ON x.id = s.doctor_id JOIN specialties p ON p.id = x.specialty_id WHERE x.name = ? AND p.name = ? ORDER BY s.weekday, s.start_time`, doc, spec).map((r) => ({ ...r }));
    assert.deepEqual(sched('Dr. Daniel Loor', 'Cardiología'), [{ d: 6, a: '08:00', b: '11:45' }]);
    assert.equal(sched('Dra. Gabriela Táquez', 'Traumatología').length, 6);
    assert.equal(sched('Dra. Roxana Barreto', 'Medicina General').length, 0);
    assert.deepEqual(sched('Dra. Roxana Barreto', 'Ginecología').filter((r: any) => r.d === 1), [{ d: 1, a: '08:00', b: '13:00' }]);
    assert.deepEqual(sched('Dra. Roxana Barreto', 'Dermatología').filter((r: any) => r.d === 1), [{ d: 1, a: '14:00', b: '18:00' }]);
    assert.deepEqual(sched('Dra. María Abreu', 'Otorrinolaringología'), [{ d: 2, a: '12:00', b: '17:00' }, { d: 4, a: '12:00', b: '17:00' }]);
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

test('piloto ProSalud: Medicina General sin cita informa horarios; el resto agenda en bloques de 45 min', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const talk = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x, { now: '2026-10-05T10:00' }).replies.join('\n'));
    // «Atención fija»: informa los días (de sus dos médicos juntos) sin nombrarlos; no agenda
    const mg = talk('+593990020002', 'medicina general')[0];
    assert.doesNotMatch(mg, /Barreto|Coello|Mazzini/);
    assert.match(mg, /🕒 lun 08:00–18:00 · mié 07:00–12:00 · jue 08:00–13:00 · vie 07:00–12:00 y 13:00–18:00 · sáb 08:00–12:00/);
    assert.match(mg, /Hablar con recepción/);
    assert.equal(all(db, 'SELECT id FROM appointments').length, 0);
    // «médicos»: ProSalud no muestra nombres en el chat; lista cada especialidad con sus días
    const docs = talk('+593990020003', 'médicos')[0];
    assert.match(docs, /Días y horarios de atención/);
    assert.match(docs, /Ginecología\* \(con cita previa\): lun–vie 08:00–13:00/);
    assert.match(docs, /Dermatología\* \(con cita previa\): lun–vie 14:00–18:00/);
    assert.doesNotMatch(docs, /Dra\.|Dr\.|Psic\.|Lic\./);
    // con cita: Cardiología, Psicología y Traumatología; separadas de «Otros servicios»
    const list = talk('+593990020004', 'Hola', '4', 'si', 'Ana Gil Mora')[3];
    const [citas, otros] = list.split('Otros servicios');
    for (const n of ['Cardiología', 'Psicología', 'Traumatología', 'Otorrinolaringología', 'Pediatría', 'Ginecología', 'Dermatología']) assert.match(citas, new RegExp(n));
    for (const n of ['Medicina General', 'Odontología', 'Laboratorio', 'Cirugía Menor']) { assert.match(otros, new RegExp(n)); assert.doesNotMatch(citas, new RegExp(n)); }
    // Traumatología 8:00–11:30 con citas de 45 min: caben 8:00, 8:45, 9:30 y 10:15
    const slots = talk('+593990020004', 'traumatologia')[0];
    const times = [...slots.matchAll(/\*\d\.\* \S+ \d+ de \S+, (\d\d:\d\d)/g)].map((m) => m[1]);
    assert.ok(times.length >= 3 && times.every((t) => ['08:00', '08:45', '09:30', '10:15'].includes(t)), times.join(','));
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Pediatría, Ginecología, Dermatología y Otorrinolaringología se agendan con cita de 45 min', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const say = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x, { now: '2026-03-04T07:00' }).replies.join('\n'));
    const hours = (t: string) => [...t.matchAll(/\*\d\.\* \S+ \d+ de \S+, (\d\d:\d\d)/g)].map((m) => m[1]);
    const book = (p: string, svc: string) => say(p, 'Hola', '4', 'si', 'Ana Gil Mora', svc)[4];
    const peds = book('+593990030001', 'pediatria');
    assert.match(peds, /disponibles en \*Pediatría\*/); assert.doesNotMatch(peds, /Abreu/); assert.ok(hours(peds).every((h) => ['08:30', '09:15', '10:00'].includes(h)), peds);
    const derm = book('+593990030002', 'dermatologia');
    assert.doesNotMatch(derm, /Barreto/); assert.ok(hours(derm).every((h) => ['14:00', '14:45', '15:30', '16:15', '17:00'].includes(h)), derm);
    const gine = book('+593990030003', 'ginecologia');
    assert.doesNotMatch(gine, /Barreto/); assert.ok(hours(gine).length > 0 && hours(gine).every((h) => h < '13:00'), gine);
    const oto = book('+593990030004', 'otorrino');
    assert.doesNotMatch(oto, /Abreu/); assert.ok(hours(oto).every((h) => ['12:00', '12:45', '13:30', '14:15', '15:00', '15:45'].includes(h)), oto);
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
    const list = say('+593990030013', 'Hola', '4', 'si', 'Luis Mora Paz')[3];
    assert.doesNotMatch(list.split('Otros servicios')[0], /Traumatología/);
    // llega un médico nuevo: se agrega desde el panel (aquí por SQL) y vuelve a agendarse sin tocar nada más
    const spec = one<any>(db, `SELECT id FROM specialties WHERE name = 'Traumatología'`).id;
    const doc = Number(dbRun(db, `INSERT INTO doctors (clinic_id, specialty_id, name, slot_minutes) VALUES (?,?,?,60)`, cid, spec, 'Dr. Nuevo Traumatólogo').lastInsertRowid);
    for (const d of [1, 2, 3, 4, 5, 6]) dbRun(db, `INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)`, cid, doc, d, '08:00', '12:00');
    const list2 = say('+593990030014', 'Hola', '4', 'si', 'Luis Mora Paz')[3];
    assert.match(list2.split('Otros servicios')[0], /Traumatología/);
    const t = say('+593990030014', 'traumatologia')[0];
    assert.match(t, /Estos son los próximos horarios disponibles en \*Traumatología\*/); assert.doesNotMatch(t, /Nuevo Traumatólogo/);
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

test('ProSalud sin nombres de médicos en el chat: reserva, mis citas y recordatorio solo con la especialidad; el panel conserva el médico', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prosalud-'));
  const path = join(dir, 'p.db');
  try {
    assert.equal(run(path, 'a@b.co', 'Admin').status, 0);
    const db = openDb(path);
    const cid = one<any>(db, 'SELECT id FROM clinics').id;
    const say = (p: string, ...l: string[]) => l.map((x) => handleIncoming(db, cid, p, x).replies.join('\n'));
    // Un segundo cardiólogo con el mismo horario: las horas repetidas se muestran una sola vez y no se pregunta «¿con qué profesional?»
    const spec = one<any>(db, `SELECT id FROM specialties WHERE name = 'Cardiología'`).id;
    const loor = one<any>(db, `SELECT id FROM doctors WHERE specialty_id = ?`, spec).id;
    const doc2 = Number(dbRun(db, `INSERT INTO doctors (clinic_id, specialty_id, name, slot_minutes) SELECT clinic_id, specialty_id, 'Dr. Segundo Cardiólogo', slot_minutes FROM doctors WHERE id = ?`, loor).lastInsertRowid);
    dbRun(db, `INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) SELECT clinic_id, ?, weekday, start_time, end_time FROM schedules WHERE doctor_id = ?`, doc2, loor);
    const r = say('+593990040001', 'Hola', '4', 'si', 'Ana Gil Mora', 'cardiologia', '1', 'si');
    const slots = r[4];
    assert.doesNotMatch(slots, /profesional|Loor|Segundo/);
    const times = [...slots.matchAll(/\*\d\.\* (.+)/g)].map((m) => m[1]);
    assert.equal(new Set(times).size, times.length, slots);
    for (const t of [r[5], r[6]]) { assert.match(t, /🩺 Cardiología\n/); assert.doesNotMatch(t, /Loor|Segundo|Dr\./); }
    const mine = say('+593990040001', 'mis citas')[0];
    assert.match(mine, /— Cardiología/); assert.doesNotMatch(mine, /Loor|Segundo/);
    // El panel sí guarda el médico asignado
    assert.ok([loor, doc2].includes(one<any>(db, `SELECT doctor_id FROM appointments`).doctor_id));
    // Recordatorio: «su cita de Cardiología»
    const start = one<any>(db, `SELECT start_at FROM appointments`).start_at as string;
    runRemindersForClinic(db, getClinic(db, cid)!, `${start.slice(0, 10)}T00:00`);
    const rem = one<any>(db, `SELECT body FROM messages WHERE kind = 'reminder'`).body;
    assert.match(rem, /su cita de Cardiología/); assert.doesNotMatch(rem, /Loor|Segundo/);
    // Si el paciente nombra al médico, se le entiende pero no se repite el nombre
    const byName = say('+593990040002', 'disponibilidad del doctor Loor')[0];
    assert.match(byName, /\*Cardiología\*/); assert.doesNotMatch(byName, /Loor/);
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
