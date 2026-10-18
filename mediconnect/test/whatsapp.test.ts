import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { openDb, one, all, run } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { createApp } from '../src/server.ts';
import { parseWebhook, sendText, setRetryDelay, setTransport, verifyChallenge, verifySignature, whatsappConfigProblems, type HttpResult } from '../src/channels/whatsapp.ts';
import { processWebhook, STAFF_PAUSE_REASON } from '../src/services/whatsapp-inbound.ts';
import { getClinic } from '../src/services/clinic.ts';

const TOKEN = 'token-de-prueba-123';
let sent: { url: string; headers: Record<string, string>; body: any }[] = [];
let respond: () => HttpResult = () => ({ status: 200, body: { messages: [{ id: 'wamid.out' }] } });
let n = 0;
// El seed de demostración usa identificadores de mentira; los reales de Meta son numéricos.
const clinicRow = (db: any) => { run(db, `UPDATE clinics SET whatsapp_phone_id = '10987654321' || id`); return one<{ id: number; whatsapp_phone_id: string }>(db, 'SELECT id, whatsapp_phone_id FROM clinics ORDER BY id LIMIT 1')!; };

beforeEach(() => {
  sent = []; respond = () => ({ status: 200, body: {} });
  process.env.WHATSAPP_TOKEN = TOKEN; setRetryDelay(0);
  setTransport(async (url, init) => { sent.push({ url, headers: init.headers, body: JSON.parse(init.body) }); return respond(); });
});
afterEach(() => { setTransport(null); delete process.env.WHATSAPP_TOKEN; delete process.env.WHATSAPP_ENABLED; delete process.env.WHATSAPP_APP_SECRET; delete process.env.WHATSAPP_VERIFY_TOKEN; });

const textMsg = (phoneId: string, from: string, body: string, id = `wamid.${++n}`) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages: [{ id, from, type: 'text', text: { body } }] } }] }] });
const echoMsg = (phoneId: string, to: string, body: string, id = `wamid.e${++n}`) => ({ entry: [{ changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: phoneId }, message_echoes: [{ id, from: '593900000000', to, type: 'text', text: { body } }] } }] }] });

test('parseWebhook: texto, botones, audio, ecos y errores de entrega; ignora reacciones', () => {
  const v = (extra: any) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '111' }, ...extra } }] }] });
  const p = parseWebhook(v({
    messages: [
      { id: 'a', from: '593991112222', type: 'text', text: { body: 'Hola' } },
      { id: 'b', from: '593991112222', type: 'interactive', interactive: { button_reply: { title: 'Sí' } } },
      { id: 'c', from: '593991112222', type: 'audio' },
      { id: 'd', from: '593991112222', type: 'reaction' },
    ],
    message_echoes: [{ id: 'e', to: '593991112222', type: 'text', text: { body: 'Ya le atiendo' } }],
    statuses: [{ status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] }, { status: 'delivered' }],
  }));
  assert.deepEqual(p.inbound.map((m) => [m.kind, m.text, m.from]), [['text', 'Hola', '+593991112222'], ['text', 'Sí', '+593991112222'], ['unsupported', '', '+593991112222']]);
  assert.equal(p.inbound[2].unsupportedType, 'audio');
  assert.deepEqual(p.echoes.map((e) => [e.to, e.text]), [['+593991112222', 'Ya le atiendo']]);
  assert.match(p.statusErrors[0], /131047/);
  assert.deepEqual(parseWebhook(null), { inbound: [], echoes: [], statusErrors: [] });
});

test('firma y verificación del webhook', () => {
  const raw = Buffer.from('{"a":1}'), good = 'sha256=' + createHmac('sha256', 's3cret').update(raw).digest('hex');
  assert.ok(verifySignature(raw, good, 's3cret'));
  assert.ok(!verifySignature(raw, good, 'otro'));
  assert.ok(!verifySignature(raw, undefined, 's3cret'));
  assert.ok(!verifySignature(raw, 'sha256=zz', 's3cret'));
  assert.ok(verifyChallenge('subscribe', 'tok', 'tok'));
  assert.ok(!verifyChallenge('subscribe', 'mal', 'tok') && !verifyChallenge('subscribe', 'tok', undefined) && !verifyChallenge('x', 'tok', 'tok'));
  assert.deepEqual(whatsappConfigProblems({ WHATSAPP_TOKEN: 'x' } as any), ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET']);
});

test('sendText: formato de la API, reintentos en 5xx, sin reintento en 4xx y el token nunca sale en el error', async () => {
  await sendText('123456789', '+593991112222', 'Hola');
  assert.equal(sent[0].url, 'https://graph.facebook.com/v21.0/123456789/messages');
  assert.equal(sent[0].headers.Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(sent[0].body, { messaging_product: 'whatsapp', recipient_type: 'individual', to: '593991112222', type: 'text', text: { preview_url: true, body: 'Hola' } });
  sent = []; let calls = 0; respond = () => (++calls < 3 ? { status: 503, body: {} } : { status: 200, body: {} });
  await sendText('123456789', '+593991112222', 'x');
  assert.equal(sent.length, 3);
  sent = []; respond = () => ({ status: 400, body: { error: { message: 'Invalid parameter', code: 100 } } });
  await assert.rejects(() => sendText('123456789', '+593991112222', 'x'), (e: any) => { assert.match(e.message, /400.*Invalid parameter.*100/); assert.ok(!e.message.includes(TOKEN)); return true; });
  assert.equal(sent.length, 1);
  await assert.rejects(() => sendText('abc', '+593991112222', 'x'), /phone_number_id/);
  delete process.env.WHATSAPP_TOKEN;
  await assert.rejects(() => sendText('123456789', '+593991112222', 'x'), /WHATSAPP_TOKEN/);
});

test('mensaje del paciente: el bot responde por WhatsApp y la conversación queda registrada', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db);
  await processWebhook(db, parseWebhook(textMsg(c.whatsapp_phone_id, '593991110001', 'Hola')));
  assert.ok(sent.length >= 1);
  assert.ok(sent.every((s) => s.url.includes(`/${c.whatsapp_phone_id}/messages`) && s.body.to === '593991110001'));
  const conv = one<any>(db, `SELECT id FROM conversations WHERE patient_phone = '+593991110001'`);
  assert.ok(all(db, 'SELECT 1 FROM messages WHERE conversation_id = ? AND sender = ?', conv.id, 'bot').length >= 1);
});

test('idempotencia: si Meta reenvía el mismo mensaje no se responde dos veces', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db);
  const body = textMsg(c.whatsapp_phone_id, '593991110002', 'Hola', 'wamid.repetido');
  await processWebhook(db, parseWebhook(body)); const first = sent.length;
  await processWebhook(db, parseWebhook(body));
  assert.equal(sent.length, first);
  assert.equal(all(db, `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id AND c.clinic_id = m.clinic_id WHERE m.direction = 'in' AND c.patient_phone = '+593991110002'`).length, 1);
});

test('número desconocido: no se procesa ni se responde', async () => {
  const db = openDb(':memory:'); seedDemo(db); clinicRow(db);
  await processWebhook(db, parseWebhook(textMsg('999000999', '593991110003', 'Hola')));
  assert.equal(sent.length, 0);
  assert.equal(all(db, `SELECT 1 FROM conversations WHERE patient_phone = '+593991110003'`).length, 0);
});

test('si el personal responde desde el celular, el bot se calla; vuelve tras la pausa; las emergencias siempre se atienden', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db), pid = c.whatsapp_phone_id, ph = '593991110004';
  const t0 = '2026-03-02T15:00:00.000Z', hours = (h: number) => new Date(Date.parse(t0) + h * 3600000).toISOString();
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'Hola')), { at: t0 });
  await processWebhook(db, parseWebhook(echoMsg(pid, ph, 'Buenas, yo le ayudo')), { at: hours(0.1) });
  const conv = one<any>(db, `SELECT id, status, handoff_reason FROM conversations WHERE patient_phone = '+${ph}'`);
  assert.equal(conv.status, 'human'); assert.equal(conv.handoff_reason, STAFF_PAUSE_REASON);
  assert.ok(all(db, `SELECT 1 FROM messages WHERE conversation_id = ? AND sender = 'staff'`, conv.id).length === 1);
  sent = [];
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'quiero una cita')), { at: hours(1) });
  assert.equal(sent.length, 0, 'con una persona atendiendo el bot no interviene');
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'me duele el pecho y no puedo respirar')), { at: hours(1.1) });
  assert.ok(sent.length >= 1 && /911/.test(sent[0].body.text.body), 'la emergencia se responde aunque atienda una persona');
  sent = [];
  const pause = getClinic(db, c.id)!.settings.staff_pause_hours;
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'hola')), { at: hours(pause + 1) });
  assert.ok(sent.length >= 1, 'pasada la pausa el bot vuelve a atender');
  assert.equal(one<any>(db, 'SELECT status FROM conversations WHERE id = ?', conv.id).status, 'bot');
});

test('la pausa por derivación a una persona NO se levanta sola', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db), pid = c.whatsapp_phone_id, ph = '593991110005';
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'Hola')));
  run(db, `UPDATE conversations SET status = 'human', handoff_reason = 'Pidió hablar con una persona' WHERE patient_phone = ?`, `+${ph}`);
  sent = [];
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'hola de nuevo')), { at: '2030-01-01T00:00:00.000Z' });
  assert.equal(sent.length, 0);
});

test('audio, imagen u otros tipos: se pide texto y se menciona el 911; no responde si atiende una persona', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db), pid = c.whatsapp_phone_id, ph = '593991110006';
  const audio = (id: string) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: pid }, messages: [{ id, from: ph, type: 'audio', audio: { id: 'm1' } }] } }] }] });
  await processWebhook(db, parseWebhook(audio('wamid.au1')));
  assert.equal(sent.length, 1); assert.match(sent[0].body.text.body, /texto.*911/s);
  run(db, `UPDATE conversations SET status = 'human' WHERE patient_phone = ?`, `+${ph}`); sent = [];
  await processWebhook(db, parseWebhook(audio('wamid.au2')));
  assert.equal(sent.length, 0);
});

test('si WhatsApp rechaza el envío, queda una alerta urgente en el panel y no se cae el procesamiento', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db);
  respond = () => ({ status: 401, body: { error: { message: 'Token expirado', code: 190 } } });
  const errs: any[] = []; const orig = console.error; console.error = (...a: any[]) => { errs.push(a); };
  try { await processWebhook(db, parseWebhook(textMsg(c.whatsapp_phone_id, '593991110007', 'Hola'))); } finally { console.error = orig; }
  const alert = one<any>(db, `SELECT level, body FROM notifications WHERE type = 'send_failed'`);
  assert.equal(alert.level, 'urgent'); assert.ok(!alert.body.includes(TOKEN));
  assert.ok(errs.length >= 1);
});

test('HTTP: deshabilitado por defecto, verificación, firma inválida y firma válida', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db);
  const server = createServer(createApp(db)); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}/webhook/whatsapp`;
  try {
    assert.equal((await fetch(base)).status, 503);
    process.env.WHATSAPP_ENABLED = 'true'; process.env.WHATSAPP_VERIFY_TOKEN = 'verif'; process.env.WHATSAPP_APP_SECRET = 'secreto';
    const ok = await fetch(`${base}?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=777`);
    assert.equal(ok.status, 200); assert.equal(await ok.text(), '777');
    assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=777`)).status, 403);
    const raw = JSON.stringify(textMsg(c.whatsapp_phone_id, '593991110008', 'Hola'));
    assert.equal((await fetch(base, { method: 'POST', body: raw, headers: { 'x-hub-signature-256': 'sha256=00' } })).status, 401);
    assert.equal(sent.length, 0);
    const sig = 'sha256=' + createHmac('sha256', 'secreto').update(raw).digest('hex');
    assert.equal((await fetch(base, { method: 'POST', body: raw, headers: { 'x-hub-signature-256': sig } })).status, 200);
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(sent.length >= 1);
    assert.equal((await fetch(base, { method: 'PUT' })).status, 405);
  } finally { server.close(); }
});

test('respuesta desde el panel: sale por WhatsApp y, si falla, no se registra como enviada', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db);
  process.env.WHATSAPP_ENABLED = 'true';
  const server = createServer(createApp(db)); await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = (m: string, p: string, b?: unknown, ck = '') => fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', ...(ck ? { Cookie: ck } : {}) }, body: b ? JSON.stringify(b) : undefined });
  try {
    const email = one<any>(db, `SELECT email FROM users WHERE clinic_id = ? AND role = 'admin' LIMIT 1`, c.id).email;
    const ck = (await call('POST', '/api/login', { email, password: 'Demo1234!' })).headers.get('set-cookie')!.split(';')[0];
    await processWebhook(db, parseWebhook(textMsg(c.whatsapp_phone_id, '593991110009', 'Hola')));
    const conv = one<any>(db, `SELECT id FROM conversations WHERE patient_phone = '+593991110009'`); sent = [];
    assert.equal((await call('POST', `/api/conversations/${conv.id}/reply`, { text: 'Hola, le escribe recepción' }, ck)).status, 200);
    assert.equal(sent.length, 1); assert.equal(sent[0].body.text.body, 'Hola, le escribe recepción');
    respond = () => ({ status: 400, body: { error: { message: 'fuera de ventana', code: 131047 } } });
    const bad = await call('POST', `/api/conversations/${conv.id}/reply`, { text: 'No sale' }, ck);
    assert.equal(bad.status, 502);
    assert.equal(all(db, `SELECT 1 FROM messages WHERE body = 'No sale'`).length, 0);
  } finally { server.close(); }
});

test('whatsapp:phone asocia el número a la clínica y valida el formato', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'wa-')), path = join(dir, 'p.db');
  try {
    const db = openDb(path); seedDemo(db); db.close();
    const cli = (id: string) => spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/whatsapp-cli.ts', id, `--db=${path}`], { encoding: 'utf8' });
    assert.notEqual(cli('abc').status, 0);
    assert.equal(cli('123456789012345').status, 0);
    const db2 = openDb(path); assert.equal(one<any>(db2, 'SELECT whatsapp_phone_id AS w FROM clinics ORDER BY id LIMIT 1').w, '123456789012345'); db2.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('un eco con el mismo texto que acaba de enviar el bot no pausa la conversación', async () => {
  const db = openDb(':memory:'); seedDemo(db); const c = clinicRow(db), pid = c.whatsapp_phone_id, ph = '593991110010';
  await processWebhook(db, parseWebhook(textMsg(pid, ph, 'Hola')));
  const botText = sent[0].body.text.body;
  await processWebhook(db, parseWebhook(echoMsg(pid, ph, botText)));
  assert.equal(one<any>(db, `SELECT status FROM conversations WHERE patient_phone = '+${ph}'`).status, 'bot');
});
