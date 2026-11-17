import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createPublicKey, verify } from 'node:crypto';
import { openDb, one } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { createApp } from '../src/server.ts';
import { setAlertGap, vapidAuth, vapidPublicKey } from '../src/services/push.ts';

// Los avisos salen hacia el servicio de notificaciones del navegador: aquí se interceptan (no hay red).
const sent: { url: string; headers: Record<string, string> }[] = [];
let pushStatus = 201;
const realFetch = globalThis.fetch;
let server: Server, base = '', db: any;
before(async () => {
  globalThis.fetch = (async (url: any, init?: any) => {
    if (String(url).startsWith('https://fcm.googleapis.com/')) { sent.push({ url: String(url), headers: init?.headers ?? {} }); return new Response(null, { status: pushStatus }); }
    return realFetch(url, init);
  }) as typeof fetch;
  setAlertGap(0);
  db = openDb(':memory:'); seedDemo(db);
  server = createServer(createApp(db));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => { server.close(); globalThis.fetch = realFetch; });

async function call(method: string, path: string, body?: unknown, cookie = '') {
  const res = await realFetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
const login = async (email: string) => (await call('POST', '/api/login', { email, password: 'Demo1234!' })).cookie;
const settle = () => new Promise((r) => setTimeout(r, 50));
const EP = 'https://fcm.googleapis.com/fcm/send/abc123';

test('firma VAPID: JWT ES256 válido para el servicio del endpoint', () => {
  const h = vapidAuth(db, EP);
  const [, jwt, k] = h.match(/^vapid t=([^,]+), k=(.+)$/)!;
  assert.equal(k, vapidPublicKey(db));
  const [head, claims, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  const c = JSON.parse(Buffer.from(claims, 'base64url').toString());
  assert.equal(c.aud, 'https://fcm.googleapis.com');
  assert.ok(c.exp > Date.now() / 1000 && c.exp <= Date.now() / 1000 + 24 * 3600);
  const raw = Buffer.from(k, 'base64url');
  const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64(raw.subarray(1, 33)), y: b64(raw.subarray(33)) }, format: 'jwk' });
  assert.ok(verify('sha256', Buffer.from(`${head}.${claims}`), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')));
  assert.equal(vapidPublicKey(db), k);   // las claves se crean una sola vez
});
const b64 = (b: Buffer) => b.toString('base64url');

test('suscripción: solo servicios de notificaciones de navegadores; la prueba llega al dispositivo', async () => {
  const r = await login('recepcion@santalucia.demo');
  for (const bad of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://evil.example/fcm.googleapis.com', 'https://fcm.googleapis.com:8443/x', 42])
    assert.equal((await call('POST', '/api/push/subscribe', { endpoint: bad }, r)).status, 400, String(bad));
  assert.equal((await call('POST', '/api/push/subscribe', { endpoint: EP }, r)).status, 200);
  assert.equal((await call('POST', '/api/push/subscribe', { endpoint: EP }, r)).status, 200);   // repetir no duplica
  assert.equal(one(db, 'SELECT COUNT(*) n FROM push_subs').n, 1);
  sent.length = 0;
  assert.deepEqual((await call('POST', '/api/push/test', {}, r)).data, { sent: 1, failed: 0 });
  assert.equal(sent[0].url, EP);
  assert.match(sent[0].headers.Authorization, /^vapid t=/);
  assert.equal(sent[0].headers.Urgency, 'high');
});

test('avisa cuando un paciente espera a recepción y cuando escribe en un chat atendido', async () => {
  const a = await login('admin@santalucia.demo'), phone = '+593990007001';
  sent.length = 0;
  await call('POST', '/api/simulator/message', { phone, text: 'hola' }, a);
  await settle();
  assert.equal(sent.length, 0);   // conversación normal con el bot: no hay aviso
  await call('POST', '/api/simulator/message', { phone, text: 'quiero hablar con una persona' }, a);
  await settle();
  assert.equal(sent.length, 1);
  await call('POST', '/api/simulator/message', { phone, text: 'sigo esperando' }, a);
  await settle();
  assert.equal(sent.length, 2);
  const w = (await call('GET', '/api/summary', undefined, a)).data.waiting_human.find((c: any) => c.patient_phone === phone);
  assert.ok(w.last_in_id > 0);   // el panel usa este dato para sonar
});

test('otra clínica no recibe los avisos; un dispositivo dado de baja (410) se borra', async () => {
  const m = await login('admin@medisur.demo');
  sent.length = 0;
  await call('POST', '/api/simulator/message', { phone: '+593990007002', text: 'quiero hablar con una persona' }, m);
  await settle();
  assert.equal(sent.length, 0);
  pushStatus = 410;
  const r = await login('recepcion@santalucia.demo');
  assert.deepEqual((await call('POST', '/api/push/test', {}, r)).data, { sent: 0, failed: 1 });
  assert.equal(one(db, 'SELECT COUNT(*) n FROM push_subs').n, 0);
  pushStatus = 201;
});

test('al desactivar un usuario o cerrar el aviso en su equipo, deja de recibir avisos', async () => {
  const r = await login('recepcion@santalucia.demo'), a = await login('admin@santalucia.demo');
  await call('POST', '/api/push/subscribe', { endpoint: EP }, r);
  await call('POST', '/api/push/unsubscribe', { endpoint: EP }, r);
  assert.equal(one(db, 'SELECT COUNT(*) n FROM push_subs').n, 0);
  await call('POST', '/api/push/subscribe', { endpoint: EP }, r);
  const uid = one(db, `SELECT id FROM users WHERE email = 'recepcion@santalucia.demo'`).id;
  assert.equal((await call('PATCH', `/api/users/${uid}`, { active: false }, a)).status, 200);
  assert.equal(one(db, 'SELECT COUNT(*) n FROM push_subs').n, 0);
});
