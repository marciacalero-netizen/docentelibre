import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { openDb, one, all } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { createApp } from '../src/server.ts';

let server: Server, base = '', db: any;
before(async () => { db = openDb(':memory:'); seedDemo(db); server = createServer(createApp(db)); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${(server.address() as any).port}`; });
after(() => { server.close(); });

async function call(method: string, path: string, body?: unknown, cookie = '') {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) as any, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
const login = async (email: string, password = 'Demo1234!') => (await call('POST', '/api/login', { email, password })).cookie;
const ADMIN = 'admin@santalucia.demo';

test('usuario nuevo: entra con clave temporal pero solo puede crear su contraseña', async () => {
  const admin = await login(ADMIN);
  assert.equal((await call('POST', '/api/users', { name: 'Nueva Recepción', email: 'nueva@centro.test', password: 'Temporal123!', role: 'receptionist' }, admin)).status, 200);
  assert.equal(one<any>(db, `SELECT must_change FROM users WHERE email = 'nueva@centro.test'`).must_change, 1);
  const c = await login('nueva@centro.test', 'Temporal123!');
  assert.equal((await call('GET', '/api/me', undefined, c)).data.user.must_change, true);
  for (const p of ['/api/summary', '/api/patients', '/api/appointments?from=2026-01-01&to=2026-12-31', '/api/conversations']) {
    const r = await call('GET', p, undefined, c);
    assert.equal(r.status, 403, p); assert.equal(r.data.must_change, true);
  }
});

test('cambiar la contraseña: valida, cierra otras sesiones y libera el panel', async () => {
  const c = await login('nueva@centro.test', 'Temporal123!'), other = await login('nueva@centro.test', 'Temporal123!');
  assert.equal((await call('POST', '/api/me/password', { current: 'incorrecta', password: 'NuevaClave2026!' }, c)).status, 403);
  assert.equal((await call('POST', '/api/me/password', { current: 'Temporal123!', password: 'corta' }, c)).status, 400);
  assert.equal((await call('POST', '/api/me/password', { current: 'Temporal123!', password: 'Temporal123!' }, c)).status, 400);
  assert.equal((await call('POST', '/api/me/password', { current: 'Temporal123!', password: 'NuevaClave2026!' }, c)).status, 200);
  assert.equal((await call('GET', '/api/summary', undefined, c)).status, 200);              // ya puede trabajar
  assert.equal((await call('GET', '/api/summary', undefined, other)).status, 401);          // la otra sesión se cerró
  assert.equal((await call('POST', '/api/login', { email: 'nueva@centro.test', password: 'Temporal123!' })).status, 401);
  assert.equal((await call('POST', '/api/login', { email: 'nueva@centro.test', password: 'NuevaClave2026!' })).status, 200);
  assert.equal(one<any>(db, `SELECT must_change FROM users WHERE email = 'nueva@centro.test'`).must_change, 0);
});

test('restablecer contraseña: solo el administrador de la misma clínica; la persona debe crear otra', async () => {
  const admin = await login(ADMIN), rec = await login('recepcion@santalucia.demo'), other = await login('admin@medisur.demo');
  const u = one<any>(db, `SELECT id FROM users WHERE email = 'nueva@centro.test'`).id;
  const session = await login('nueva@centro.test', 'NuevaClave2026!');
  assert.equal((await call('PATCH', `/api/users/${u}`, { password: 'Reinicio2026!!' }, rec)).status, 403);
  assert.equal((await call('PATCH', `/api/users/${u}`, { password: 'Reinicio2026!!' }, other)).status, 404);      // otra clínica: no existe
  assert.equal((await call('PATCH', `/api/users/${u}`, { password: 'corta' }, admin)).status, 400);
  assert.equal((await call('PATCH', `/api/users/${u}`, { password: 'Reinicio2026!!' }, admin)).status, 200);
  assert.equal((await call('GET', '/api/summary', undefined, session)).status, 401);                               // su sesión abierta se cerró
  const c = await login('nueva@centro.test', 'Reinicio2026!!');
  assert.equal((await call('GET', '/api/summary', undefined, c)).status, 403);                                     // debe crear la suya
  assert.equal((await call('POST', '/api/me/password', { current: 'Reinicio2026!!', password: 'ClavePropia2026!' }, c)).status, 200);
});

test('desactivar y reactivar usuarios, con protecciones', async () => {
  const admin = await login(ADMIN);
  const users = (await call('GET', '/api/users', undefined, admin)).data;
  const me = users.find((x: any) => x.is_me), nueva = users.find((x: any) => x.email === 'nueva@centro.test');
  assert.equal((await call('PATCH', `/api/users/${me.id}`, { active: false }, admin)).status, 400);                // no a sí mismo
  const c = await login('nueva@centro.test', 'ClavePropia2026!');
  assert.equal((await call('PATCH', `/api/users/${nueva.id}`, { active: false }, admin)).status, 200);
  assert.equal((await call('GET', '/api/summary', undefined, c)).status, 401);                                     // su sesión se cerró
  assert.equal((await call('POST', '/api/login', { email: 'nueva@centro.test', password: 'ClavePropia2026!' })).status, 401);
  assert.equal((await call('PATCH', `/api/users/${nueva.id}`, { active: true }, admin)).status, 200);
  assert.equal((await call('POST', '/api/login', { email: 'nueva@centro.test', password: 'ClavePropia2026!' })).status, 200);
  // nunca puede quedar la clínica sin un administrador activo
  const second = (await call('POST', '/api/users', { name: 'Segundo Admin', email: 'admin2@centro.test', password: 'Temporal123!', role: 'admin' }, admin)).status;
  assert.equal(second, 200);
  const a2 = one<any>(db, `SELECT id FROM users WHERE email = 'admin2@centro.test'`).id;
  const a2c = await login('admin2@centro.test', 'Temporal123!');
  await call('POST', '/api/me/password', { current: 'Temporal123!', password: 'SegundaClave2026!' }, a2c);
  assert.equal((await call('PATCH', `/api/users/${me.id}`, { active: false }, a2c)).status, 200);                  // el 2.º admin desactiva al 1.º: queda él
  assert.equal((await call('PATCH', `/api/users/${a2}`, { active: false }, a2c)).status, 400);                     // a sí mismo
  const reactivated = await call('PATCH', `/api/users/${me.id}`, { active: true }, a2c); assert.equal(reactivated.status, 200);
  assert.ok(all(db, `SELECT id FROM audit_log WHERE action IN ('password_change','password_reset','deactivate','activate')`).length >= 4);   // queda registro
});
