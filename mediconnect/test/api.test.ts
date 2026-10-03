import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { openDb, one } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { createApp } from '../src/server.ts';

let server: Server, base = '', db: any;
before(async () => {
  db = openDb(':memory:'); seedDemo(db);
  server = createServer(createApp(db));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => { server.close(); });

async function call(method: string, path: string, body?: unknown, cookie = '', extra: Record<string, string> = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', ...(cookie ? { Cookie: cookie } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
const login = async (email: string) => (await call('POST', '/api/login', { email, password: 'Demo1234!' })).cookie;

test('login: credenciales incorrectas y sesión requerida', async () => {
  assert.equal((await call('POST', '/api/login', { email: 'admin@santalucia.demo', password: 'mala' })).status, 401);
  assert.equal((await call('GET', '/api/patients')).status, 401);
  assert.equal((await call('POST', '/api/login', { email: 'admin@santalucia.demo', password: 'Demo1234!' })).status, 200);
});

test('CSRF: las escrituras sin el encabezado personalizado se rechazan', async () => {
  const c = await login('admin@santalucia.demo');
  const res = await fetch(base + '/api/notifications/read-all', { method: 'POST', headers: { Cookie: c } });
  assert.equal(res.status, 403);
});

test('aislamiento multiempresa: una clínica no ve ni modifica datos de otra', async () => {
  const a = await login('admin@santalucia.demo'), b = await login('admin@medisur.demo');
  const pa = (await call('GET', '/api/patients', undefined, a)).data, pb = (await call('GET', '/api/patients', undefined, b)).data;
  assert.ok(pa.length > 0 && pb.length > 0);
  const idsA = new Set(pa.map((p: any) => p.id)), idsB = new Set(pb.map((p: any) => p.id));
  assert.equal([...idsA].filter((i) => idsB.has(i)).length, 0);
  // acceso directo por id a un paciente de la otra clínica
  const foreign = pb[0].id;
  assert.equal((await call('GET', `/api/patients/${foreign}`, undefined, a)).status, 404);
  assert.equal((await call('POST', `/api/patients/${foreign}/anonymize`, {}, a)).status, 404);
  // citas, conversaciones y médicos ajenos
  const apptB = (await call('GET', `/api/appointments?from=2000-01-01&to=2100-01-01`, undefined, b)).data[0];
  assert.equal((await call('PATCH', `/api/appointments/${apptB.id}`, { action: 'cancel' }, a)).status, 409);
  const convB = (await call('GET', '/api/conversations', undefined, b)).data[0];
  assert.equal((await call('GET', `/api/conversations/${convB.id}`, undefined, a)).status, 404);
  assert.equal((await call('POST', `/api/conversations/${convB.id}/reply`, { text: 'x' }, a)).status, 404);
  const docB = (await call('GET', '/api/doctors', undefined, b)).data[0];
  assert.equal((await call('PATCH', `/api/doctors/${docB.id}`, { name: 'Hack', specialty_id: docB.specialty_id, slot_minutes: 30, active: true }, a)).status, 400);
  assert.equal(one<any>(db, 'SELECT name FROM doctors WHERE id = ?', docB.id).name, docB.name);
  // crear cita con médico de otra clínica
  const r = await call('POST', '/api/appointments', { doctor_id: docB.id, date: '2030-01-07', time: '09:00', phone: '+593990000001', name: 'X Y' }, a);
  assert.notEqual(r.status, 200);
  // el simulador y las alertas también son por clínica
  const nb = (await call('GET', '/api/notifications', undefined, b)).data, na = (await call('GET', '/api/notifications', undefined, a)).data;
  assert.equal(na.filter((n: any) => nb.some((m: any) => m.id === n.id)).length, 0);
});

test('roles: el recepcionista no puede administrar ni ver estadísticas', async () => {
  const r = await login('recepcion@santalucia.demo');
  assert.equal((await call('GET', '/api/stats', undefined, r)).status, 403);
  assert.equal((await call('POST', '/api/doctors', { name: 'X', specialty_id: 1, slot_minutes: 30 }, r)).status, 403);
  assert.equal((await call('PUT', '/api/clinic', {}, r)).status, 403);
  assert.equal((await call('GET', '/api/users', undefined, r)).status, 403);
  assert.equal((await call('GET', '/api/appointments?from=2026-01-01&to=2026-12-31', undefined, r)).status, 200);
});

test('simulador + panel: derivación visible y respuesta del personal', async () => {
  const c = await login('recepcion@santalucia.demo');
  const phone = '+593990006001';
  await call('POST', '/api/simulator/message', { phone, text: 'quiero hablar con una persona' }, c);
  const convs = (await call('GET', '/api/conversations', undefined, c)).data;
  const conv = convs.find((x: any) => x.patient_phone === phone);
  assert.equal(conv.status, 'human');
  await call('POST', `/api/conversations/${conv.id}/reply`, { text: 'Hola, soy recepción' }, c);
  const sim = (await call('GET', `/api/simulator/messages?phone=${encodeURIComponent(phone)}`, undefined, c)).data;
  assert.ok(sim.messages.some((m: any) => m.sender === 'staff'));
});

test('anonimización: elimina datos personales y contenido de mensajes', async () => {
  const c = await login('admin@santalucia.demo');
  const phone = '+593990006002';
  await call('POST', '/api/simulator/message', { phone, text: 'agendar' }, c);
  await call('POST', '/api/simulator/message', { phone, text: 'si' }, c);
  const p = (await call('GET', `/api/patients?q=${encodeURIComponent(phone)}`, undefined, c)).data[0];
  assert.equal((await call('POST', `/api/patients/${p.id}/anonymize`, {}, c)).status, 200);
  const after = (await call('GET', `/api/patients/${p.id}`, undefined, c)).data;
  assert.equal(after.anonymized, 1); assert.doesNotMatch(after.phone, /593/);
  assert.equal(one<any>(db, `SELECT COUNT(*) n FROM messages WHERE body LIKE '%agendar%' AND conversation_id IN (SELECT id FROM conversations WHERE patient_phone = ?)`, phone).n, 0);
});

test('webhook de WhatsApp deshabilitado por defecto', async () => {
  assert.equal((await call('POST', '/webhook/whatsapp', {})).status, 503);
});

test('archivos estáticos con cabeceras de seguridad y sin salida del directorio público', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200); assert.ok(res.headers.get('content-security-policy'));
  assert.equal((await fetch(base + '/..%2f..%2fsrc%2fdb.ts')).status, 404);
});

test('familiares en el panel: mismo número + otro nombre = familiar; anonimizar al titular elimina a ambos', async () => {
  const c = await login('admin@santalucia.demo');
  const phone = '+593990006003';
  const slotFor = async () => {
    for (let n = 1; n < 14; n++) {
      const d = new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
      const s = (await call('GET', `/api/slots?doctor_id=1&date=${d}`, undefined, c)).data;
      if (s.length >= 2) return { date: d, times: s };
    }
    throw new Error('sin horarios');
  };
  const { date, times } = await slotFor();
  assert.equal((await call('POST', '/api/appointments', { doctor_id: 1, date, time: times[0], phone, name: 'Madre Prueba Uno' }, c)).status, 200);
  assert.equal((await call('POST', '/api/appointments', { doctor_id: 1, date, time: times[1], phone, name: 'Hija Prueba Uno' }, c)).status, 200);
  const rows = (await call('GET', `/api/patients?q=${encodeURIComponent(phone)}`, undefined, c)).data;
  assert.equal(rows.length, 2);
  const holder = rows.find((r: any) => r.is_holder), kid = rows.find((r: any) => !r.is_holder);
  assert.equal(kid.holder_name, 'Madre Prueba Uno');
  assert.equal((await call('GET', `/api/patients/${holder.id}`, undefined, c)).data.family.length, 1);
  // anonimizar solo a la hija no toca a la madre
  await call('POST', `/api/patients/${kid.id}/anonymize`, {}, c);
  assert.equal(one<any>(db, 'SELECT anonymized FROM patients WHERE id = ?', holder.id).anonymized, 0);
  assert.equal(one<any>(db, 'SELECT anonymized FROM patients WHERE id = ?', kid.id).anonymized, 1);
  // anonimizar a la madre elimina también a los familiares restantes
  await call('POST', '/api/simulator/message', { phone, text: 'hola' }, c);
  const kid2 = (await call('POST', '/api/appointments', { doctor_id: 1, date, time: times[2] ?? times[0], phone, name: 'Hijo Prueba Dos' }, c)).status;
  assert.ok([200, 409].includes(kid2));
  const r = (await call('POST', `/api/patients/${holder.id}/anonymize`, {}, c)).data;
  assert.ok(r.anonymized >= 1);
  assert.equal(one<any>(db, `SELECT COUNT(*) n FROM patients WHERE phone = ? AND anonymized = 0`, phone).n, 0);
});

test('servicios: el administrador define tipo, emoji y palabras clave; el tipo se valida', async () => {
  const c = await login('admin@santalucia.demo');
  const sp = (await call('GET', '/api/specialties', undefined, c)).data.find((s: any) => s.name === 'Pediatría');
  const body = { name: sp.name, description: sp.description, price: sp.price, active: true, kind: 'appointment', emoji: '👶', keywords: 'niño,bebe', info: '' };
  assert.equal((await call('PATCH', `/api/specialties/${sp.id}`, body, c)).status, 200);
  assert.equal((await call('PATCH', `/api/specialties/${sp.id}`, { ...body, kind: 'inventado' }, c)).status, 400);
  assert.equal(one<any>(db, 'SELECT emoji FROM specialties WHERE id = ?', sp.id).emoji, '👶');
  const r = await login('recepcion@santalucia.demo');
  assert.equal((await call('PATCH', `/api/specialties/${sp.id}`, body, r)).status, 403);
  // otra clínica no puede editar este servicio
  const other = await login('admin@medisur.demo');
  assert.equal((await call('PATCH', `/api/specialties/${sp.id}`, { ...body, name: 'Hack' }, other)).status, 404);
  assert.equal((await fetch(base + '/api/public')).status, 200);
});
