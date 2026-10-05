import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, createServer as createHttp } from 'node:http';
import type { Server } from 'node:http';
import { createPublicKey, createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, all, one, run } from '../src/db.ts';
import type { DB } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { getClinic } from '../src/services/clinic.ts';
import { freeSlots } from '../src/services/availability.ts';
import { cancelAppointment, createAppointment, rescheduleAppointment } from '../src/services/appointments.ts';
import { enqueueCalendar, syncOutbox } from '../src/integrations/google-calendar.ts';
import { createApp } from '../src/server.ts';

// ── «Google» simulado ──
interface Call { method: string; url: string; auth?: string; body?: any }
let google: Server, base = '', dir = '', keyPath = '';
let calls: Call[] = [], failNext: number[] = [], missingOnPut = false, tokenChecks: string[] = [];
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

before(async () => {
  google = createHttp((req, res) => {
    let raw = ''; req.on('data', (d) => (raw += d));
    req.on('end', () => {
      const send = (s: number, j: unknown) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(s === 204 ? '' : JSON.stringify(j)); };
      if (req.url === '/token') {   // valida el JWT RS256 de la cuenta de servicio
        const jwt = new URLSearchParams(raw).get('assertion') ?? '';
        const [h, p, s] = jwt.split('.');
        const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(createPublicKey(publicKey), Buffer.from(s, 'base64url'));
        const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
        tokenChecks.push(`${ok}|${claims.iss}|${claims.scope}|${claims.aud}`);
        return ok ? send(200, { access_token: 'tok-123', expires_in: 3600 }) : send(401, { error: 'bad' });
      }
      calls.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body: raw ? JSON.parse(raw) : undefined });
      const code = failNext.shift();
      if (code) return send(code, { error: { message: 'fallo simulado' } });
      if (req.method === 'POST') return send(200, { id: `ev${calls.length}` });
      if (req.method === 'PUT') return missingOnPut ? send(404, { error: { message: 'Not Found' } }) : send(200, { id: decodeURIComponent(req.url!.split('/events/')[1]) });
      if (req.method === 'DELETE') return send(204, {});
      return send(200, { items: [] });
    });
  });
  await new Promise<void>((r) => google.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(google.address() as any).port}`;
  dir = mkdtempSync(join(tmpdir(), 'gcal-'));
  keyPath = join(dir, 'sa.json');
  writeFileSync(keyPath, JSON.stringify({ client_email: 'mediconnect@proyecto.iam.gserviceaccount.com', private_key: privateKey }));
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE = keyPath; process.env.GOOGLE_API_BASE = base; process.env.GOOGLE_TOKEN_URL = `${base}/token`;
});
after(() => { google.close(); rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { calls = []; failNext = []; missingOnPut = false; tokenChecks = []; });

const CAL = 'centro@group.calendar.google.com';
function fresh(enabled = true, style = 'name'): DB {
  const db = openDb(':memory:'); seedDemo(db);
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.google_calendar', json(?)) WHERE id = 1`, JSON.stringify({ enabled, default_calendar_id: CAL, title_style: style }));
  return db;
}
function book(db: DB, doctorId = 1, k = 0, who = 0) {
  const clinic = getClinic(db, 1)!;
  const slot = freeSlots(db, clinic, [doctorId])[k];
  const patient = one<any>(db, `SELECT id, name, phone FROM patients WHERE clinic_id = 1 AND is_holder = 1 AND anonymized = 0 AND name IS NOT NULL ORDER BY id LIMIT 1 OFFSET ${who}`)!;
  const r = createAppointment(db, clinic, { doctorId, patientId: patient.id, start: slot.start, source: 'whatsapp' });
  assert.ok(r.ok); return { id: (r as any).id as number, slot, patient, clinic };
}
const pendingCount = (db: DB) => one<any>(db, 'SELECT COUNT(*) n FROM calendar_outbox WHERE done = 0').n;

test('desactivado: no se encola nada ni se contacta a Google', async () => {
  const db = fresh(false);
  book(db);
  assert.equal(one<any>(db, 'SELECT COUNT(*) n FROM calendar_outbox').n, 0);
  assert.equal((await syncOutbox(db)).processed, 0); assert.equal(calls.length, 0);
});

test('crear cita: se crea el evento en Google con el JWT de la cuenta de servicio', async () => {
  const db = fresh();
  const { id, slot, patient } = book(db);
  assert.equal(pendingCount(db), 1);
  const r = await syncOutbox(db);
  assert.deepEqual([r.ok, r.processed, r.failed, r.pending], [true, 1, 0, 0]);
  assert.deepEqual(tokenChecks, [`true|mediconnect@proyecto.iam.gserviceaccount.com|https://www.googleapis.com/auth/calendar.events|${base}/token`]);
  const c = calls[0];
  assert.equal(c.method, 'POST'); assert.equal(c.url, `/calendars/${encodeURIComponent(CAL)}/events`); assert.equal(c.auth, 'Bearer tok-123');
  assert.match(c.body.summary, new RegExp(`^${patient.name} — `));
  assert.equal(c.body.start.dateTime, `${slot.start}:00`); assert.equal(c.body.start.timeZone, 'America/Guayaquil');
  assert.equal(c.body.extendedProperties.private.mediconnect_appointment_id, String(id));
  assert.doesNotMatch(JSON.stringify(c.body), new RegExp(patient.phone.replace('+', '\\+')));   // el teléfono nunca sale hacia Google
  const a = one<any>(db, 'SELECT gcal_event_id, gcal_calendar_id FROM appointments WHERE id = ?', id);
  assert.equal(a.gcal_event_id, 'ev1'); assert.equal(a.gcal_calendar_id, CAL);
});

test('reagendar y confirmar actualizan el mismo evento; cancelar lo borra', async () => {
  const db = fresh();
  const { id, clinic } = book(db);
  await syncOutbox(db);
  const next = freeSlots(db, clinic, [1]).find((s) => true)!;
  assert.ok(rescheduleAppointment(db, clinic, id, next.start).ok);
  await syncOutbox(db);
  assert.equal(calls[1].method, 'PUT'); assert.match(calls[1].url, /\/events\/ev1$/); assert.equal(calls[1].body.start.dateTime, `${next.start}:00`);
  run(db, 'UPDATE appointments SET confirmed = 1 WHERE id = ?', id); enqueueCalendar(db, 1, id, 'upsert');
  await syncOutbox(db);
  assert.match(calls[2].body.summary, /^✔ /);
  assert.ok(cancelAppointment(db, 1, id).ok);
  await syncOutbox(db);
  assert.equal(calls[3].method, 'DELETE'); assert.match(calls[3].url, /\/events\/ev1$/);
  assert.equal(one<any>(db, 'SELECT gcal_event_id FROM appointments WHERE id = ?', id).gcal_event_id, null);
  assert.equal(pendingCount(db), 0);
});

test('cancelar una cita que nunca llegó a Google no genera llamadas', async () => {
  const db = fresh();
  const { id } = book(db);
  cancelAppointment(db, 1, id);   // todavía en la cola
  assert.equal(pendingCount(db), 0);
  await syncOutbox(db); assert.equal(calls.length, 0);
});

test('si el evento ya no existe en Google: al borrar se da por hecho, al actualizar se recrea', async () => {
  const db = fresh();
  const { id, clinic } = book(db);
  await syncOutbox(db);
  missingOnPut = true;
  rescheduleAppointment(db, clinic, id, freeSlots(db, clinic, [1])[0].start);
  await syncOutbox(db);
  assert.deepEqual(calls.slice(1).map((c) => c.method), ['PUT', 'POST']);                       // 404 → se vuelve a crear
  assert.notEqual(one<any>(db, 'SELECT gcal_event_id FROM appointments WHERE id = ?', id).gcal_event_id, 'ev1');
  failNext = [404];
  cancelAppointment(db, 1, id);
  const r = await syncOutbox(db);
  assert.equal(r.failed, 0); assert.equal(pendingCount(db), 0);                                  // 404 al borrar = ya estaba borrado
});

test('fallos: se reintenta, se guarda el motivo y al recuperarse se completa', async () => {
  const db = fresh();
  const { id } = book(db);
  failNext = [500];
  let r = await syncOutbox(db);
  assert.deepEqual([r.ok, r.failed, r.pending], [false, 1, 1]);
  const row = one<any>(db, 'SELECT attempts, last_error FROM calendar_outbox'); assert.equal(row.attempts, 1); assert.match(row.last_error, /fallo simulado/);
  r = await syncOutbox(db);   // la cita sigue en el panel pase lo que pase; el siguiente intento funciona
  assert.deepEqual([r.ok, r.processed, r.pending], [true, 1, 0]);
  assert.ok(one<any>(db, 'SELECT gcal_event_id FROM appointments WHERE id = ?', id).gcal_event_id);
  // 403: mensaje claro de qué hacer
  const b = book(db, 1, 5); failNext = [403];
  await syncOutbox(db);
  assert.match(one<any>(db, 'SELECT last_error FROM calendar_outbox WHERE appointment_id = ?', b.id).last_error, /comparta el calendario con la cuenta de servicio/);
});

test('tras 8 fallos deja de insistir; «reintentar» lo vuelve a intentar', async () => {
  const db = fresh();
  book(db);
  failNext = Array(8).fill(500);
  for (let i = 0; i < 8; i++) await syncOutbox(db);
  assert.equal(one<any>(db, 'SELECT attempts FROM calendar_outbox').attempts, 8);
  const n = calls.length; await syncOutbox(db); assert.equal(calls.length, n);                   // ya no insiste solo
  const r = await syncOutbox(db, { retryFailed: true });
  assert.deepEqual([r.ok, r.processed], [true, 1]);
});

test('calendario propio de cada médico, calendario predeterminado y cambio de calendario', async () => {
  const db = fresh();
  run(db, `UPDATE doctors SET calendar_id = 'dra.uno@gmail.com' WHERE id = 1`);
  const a = book(db, 1); const b = book(db, 2, 0, 1);
  await syncOutbox(db);
  const byCal = calls.map((c) => decodeURIComponent(c.url.split('/')[2]));
  assert.ok(byCal.includes('dra.uno@gmail.com')); assert.ok(byCal.includes(CAL));                  // médico 1 → el suyo; médico 2 → el predeterminado
  calls = [];
  run(db, `UPDATE doctors SET calendar_id = 'otro@gmail.com' WHERE id = 1`);
  enqueueCalendar(db, 1, a.id, 'upsert'); await syncOutbox(db);
  assert.deepEqual(calls.map((c) => c.method), ['DELETE', 'POST']);                                 // se mueve del calendario viejo al nuevo
  assert.equal(one<any>(db, 'SELECT gcal_calendar_id FROM appointments WHERE id = ?', a.id).gcal_calendar_id, 'otro@gmail.com');
  assert.ok(b.id);
});

test('sin ID de calendario: error claro; sin clave de cuenta de servicio: queda pendiente', async () => {
  const db = fresh();
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.google_calendar.default_calendar_id', '') WHERE id = 1`);
  book(db); await syncOutbox(db);
  assert.match(one<any>(db, 'SELECT last_error FROM calendar_outbox').last_error, /Falta el ID del calendario/);
  const keep = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE = join(dir, 'no-existe.json');
  const r = await syncOutbox(db);
  assert.equal(r.ok, false); assert.match(r.error!, /clave de la cuenta de servicio/); assert.equal(r.pending, 1);
  process.env.GOOGLE_SERVICE_ACCOUNT_FILE = keep;
});

test('privacidad: título con iniciales en lugar del nombre completo', async () => {
  const db = fresh(true, 'initials');
  const { patient } = book(db); await syncOutbox(db);
  assert.doesNotMatch(calls[0].body.summary, new RegExp(patient.name.split(' ')[0]));
  assert.match(calls[0].body.summary, /^([A-ZÁÉÍÓÚÑ]\.)+ — /);
});

test('derecho de supresión: al anonimizar se borran los eventos de Google de ese paciente', async () => {
  const db = fresh();
  const { id, patient } = book(db); await syncOutbox(db); calls = [];
  const app = createServer(createApp(db)); await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(app.address() as any).port}`;
  const login = await fetch(`${url}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect' }, body: JSON.stringify({ email: 'admin@santalucia.demo', password: 'Demo1234!' }) });
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const r = await fetch(`${url}/api/patients/${patient.id}/anonymize`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', Cookie: cookie }, body: '{}' });
  assert.equal(r.status, 200);
  assert.equal(one<any>(db, `SELECT COUNT(*) n FROM calendar_outbox WHERE appointment_id = ? AND action = 'delete' AND done = 0`, id).n, 1);
  await syncOutbox(db);
  assert.ok(calls.some((c) => c.method === 'DELETE'));
  app.close();
});

test('API del panel: estado, prueba de calendario y guardado de ajustes (solo administrador)', async () => {
  const db = fresh(false);
  const app = createServer(createApp(db)); await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(app.address() as any).port}`;
  const login = async (email: string) => (await fetch(`${url}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect' }, body: JSON.stringify({ email, password: 'Demo1234!' }) })).headers.get('set-cookie')!.split(';')[0];
  const call = async (m: string, p: string, body: unknown, cookie: string) => { const r = await fetch(url + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', Cookie: cookie }, body: m === 'GET' ? undefined : JSON.stringify(body ?? {}) }); return { status: r.status, data: await r.json() as any }; };
  const admin = await login('admin@santalucia.demo'), rec = await login('recepcion@santalucia.demo');
  assert.equal((await call('GET', '/api/calendar/status', null, rec)).status, 403);
  const st = (await call('GET', '/api/calendar/status', null, admin)).data;
  assert.deepEqual([st.enabled, st.key_found, st.service_account_email], [false, true, 'mediconnect@proyecto.iam.gserviceaccount.com']);
  assert.equal((await call('POST', '/api/calendar/test', { calendar_id: CAL }, admin)).data.ok, true);
  failNext = [404];
  assert.match((await call('POST', '/api/calendar/test', { calendar_id: 'malo@x.com' }, admin)).data.message, /no se encontró el calendario/);
  const clinic = (await call('GET', '/api/me', null, admin)).data.clinic;
  const save = (g: any) => call('PUT', '/api/clinic', { name: clinic.name, city: clinic.city, address: clinic.address, maps_url: clinic.maps_url, settings: { ...clinic.settings, google_calendar: g } }, admin);
  assert.equal((await save({ enabled: true, default_calendar_id: 'con espacios', title_style: 'name' })).status, 400);   // ID inválido
  assert.equal((await save({ enabled: true, default_calendar_id: CAL, title_style: 'initials' })).status, 200);
  assert.deepEqual(getClinic(db, 1)!.settings.google_calendar, { enabled: true, default_calendar_id: CAL, title_style: 'initials' });
  const doc = (await call('GET', '/api/doctors', null, admin)).data[0];
  assert.equal((await call('PATCH', `/api/doctors/${doc.id}`, { name: doc.name, specialty_id: doc.specialty_id, slot_minutes: doc.slot_minutes, active: true, calendar_id: 'dra@x.com' }, admin)).status, 200);
  assert.equal(one<any>(db, 'SELECT calendar_id FROM doctors WHERE id = ?', doc.id).calendar_id, 'dra@x.com');
  // con la integración activa, una cita creada desde el panel se sincroniza
  const d = (await call('GET', '/api/doctors', null, admin)).data.find((x: any) => x.schedule.length);
  const date = ((): string => { for (let n = 1; n < 14; n++) { const t = new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); if (new Date(t + 'T00:00:00Z').getUTCDay() !== 0) return t; } return ''; })();
  const times = (await call('GET', `/api/slots?doctor_id=${d.id}&date=${date}`, null, admin)).data;
  if (times.length) {
    assert.equal((await call('POST', '/api/appointments', { doctor_id: d.id, date, time: times[0], phone: '0991230001', name: 'Prueba Calendario' }, admin)).status, 200);
    const r = (await call('POST', '/api/calendar/sync', {}, admin)).data;
    assert.equal(r.processed >= 1, true); assert.equal(r.status.pending, 0);
  }
  app.close();
});
