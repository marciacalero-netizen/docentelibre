import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { mkdtempSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDb, one, run } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { createApp } from '../src/server.ts';
import { parseWebhook, setRetryDelay, setTransport } from '../src/channels/whatsapp.ts';
import { processWebhook } from '../src/services/whatsapp-inbound.ts';
import { purgeOldMedia, setMediaDir } from '../src/services/media.ts';
import { resetPatientData } from '../src/services/reset.ts';

// Archivos de prueba (cabeceras reales de cada formato)
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PDF = Buffer.from('%PDF-1.4\n% prueba\n');
const OGG = Buffer.from('OggS' + 'x'.repeat(100));

const dir = mkdtempSync(join(tmpdir(), 'mc-media-'));
const files: Record<string, { mime: string; data: Buffer; url?: string }> = {
  '100001': { mime: 'image/jpeg', data: JPG },
  '100002': { mime: 'application/pdf', data: PDF },
  '100003': { mime: 'audio/ogg; codecs=opus', data: OGG },
  '100004': { mime: 'image/jpeg', data: JPG, url: 'https://evil.example/x.jpg' },
};
const realFetch = globalThis.fetch;
let sent: any[] = [], uploads = 0;
let server: Server, base = '', db: any;

before(async () => {
  process.env.WHATSAPP_ENABLED = 'true'; process.env.WHATSAPP_TOKEN = 'tok'; setRetryDelay(0);
  setTransport(async (_u, init) => { sent.push(JSON.parse(init.body)); return { status: 200, body: {} }; });
  globalThis.fetch = (async (url: any, init?: any) => {
    const u = String(url);
    const meta = u.match(/graph\.facebook\.com\/v[\d.]+\/(\d+)$/);
    if (meta) { const f = files[meta[1]]; return Response.json({ url: f.url ?? `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${meta[1]}`, mime_type: f.mime, file_size: f.data.length }); }
    const dl = u.match(/lookaside\.fbsbx\.com\/.*mid=(\d+)/);
    if (dl) return new Response(new Uint8Array(files[dl[1]].data), { headers: { 'content-type': files[dl[1]].mime } });
    if (/\/media$/.test(u) && init?.method === 'POST') { uploads++; return Response.json({ id: '777000' }); }
    return realFetch(url, init);
  }) as typeof fetch;
  setMediaDir(dir);
  db = openDb(':memory:'); seedDemo(db);
  run(db, `UPDATE clinics SET whatsapp_phone_id = '10987654321' WHERE id = 1`);
  server = createServer(createApp(db));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(() => { server.close(); globalThis.fetch = realFetch; setTransport(null); delete process.env.WHATSAPP_ENABLED; delete process.env.WHATSAPP_TOKEN; rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { sent = []; });

let n = 0;
const msg = (from: string, type: string, payload: any) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: '10987654321' }, messages: [{ id: `wamid.m${++n}`, from, type, [type]: payload }] } }] }] });
async function call(method: string, path: string, body?: unknown, cookie = '') {
  const res = await realFetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'mediconnect', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const ct = res.headers.get('content-type') ?? '';
  return { status: res.status, headers: res.headers, data: ct.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()), cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
const login = async (email: string) => (await call('POST', '/api/login', { email, password: 'Demo1234!' })).cookie;
const conv = (phone: string) => one<any>(db, 'SELECT id, status, handoff_reason FROM conversations WHERE patient_phone = ?', phone);

test('foto de un paciente: se guarda, Gia pasa el chat a recepción y el panel la muestra con sesión', async () => {
  await processWebhook(db, parseWebhook(msg('593990008001', 'image', { id: '100001', mime_type: 'image/jpeg', caption: 'Mi orden médica' })));
  const c = conv('+593990008001');
  assert.equal(c.status, 'human'); assert.match(c.handoff_reason, /archivo/);
  assert.match(sent[0].text.body, /Recibí su archivo/);
  const m = one<any>(db, `SELECT g.body, g.kind, d.id, d.mime FROM messages g JOIN media d ON d.message_id = g.id WHERE g.conversation_id = ?`, c.id);
  assert.equal(m.kind, 'image'); assert.match(m.body, /Foto[\s\S]*Mi orden médica/); assert.equal(m.mime, 'image/jpeg');
  assert.equal(readdirSync(join(dir, '1')).length, 1);
  assert.equal((await call('GET', `/api/media/${m.id}`)).status, 401);   // sin sesión no se ve
  const r = await login('recepcion@santalucia.demo');
  const f = await call('GET', `/api/media/${m.id}`, undefined, r);
  assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'image/jpeg'); assert.ok((f.data as Buffer).equals(JPG));
  assert.match(f.headers.get('content-security-policy')!, /sandbox/);
  const other = await login('admin@medisur.demo');
  assert.equal((await call('GET', `/api/media/${m.id}`, undefined, other)).status, 404);   // otra clínica no lo ve
  const detail = (await call('GET', `/api/conversations/${c.id}`, undefined, r)).data as any;
  assert.equal(detail.messages[0].media_id, m.id);
});

test('PDF y nota de voz mientras atiende recepción: se guardan y Gia no responde', async () => {
  await processWebhook(db, parseWebhook(msg('593990008001', 'document', { id: '100002', mime_type: 'application/pdf', filename: 'resultado.pdf' })));
  await processWebhook(db, parseWebhook(msg('593990008001', 'audio', { id: '100003', mime_type: 'audio/ogg; codecs=opus', voice: true })));
  assert.equal(sent.length, 0);
  const rows = db.prepare(`SELECT d.mime, d.filename FROM media d ORDER BY d.id`).all().map((x: any) => [x.mime, x.filename]);
  assert.deepEqual(rows.slice(-2), [['application/pdf', 'resultado.pdf'], ['audio/ogg', 'archivo.ogg']]);
});

test('una URL de descarga que no es de Meta se rechaza y el mensaje avisa a recepción', async () => {
  const orig = console.error; console.error = () => {};
  try { await processWebhook(db, parseWebhook(msg('593990008002', 'image', { id: '100004', mime_type: 'image/jpeg' }))); } finally { console.error = orig; }
  const m = one<any>(db, `SELECT g.id, g.body FROM messages g JOIN conversations c ON c.id = g.conversation_id WHERE c.patient_phone = '+593990008002' AND g.direction = 'in'`);
  assert.match(m.body, /No se pudo guardar el archivo/);
  assert.equal(one<any>(db, 'SELECT COUNT(*) n FROM media WHERE message_id = ?', m.id).n, 0);
});

test('emergencia en el texto de la foto: se responde como emergencia', async () => {
  await processWebhook(db, parseWebhook(msg('593990008003', 'image', { id: '100001', mime_type: 'image/jpeg', caption: 'me duele el pecho y no puedo respirar' })));
  assert.match(sent[0].text.body, /911/);
});

test('recepción envía una foto o PDF desde el panel; otros formatos se rechazan', async () => {
  const r = await login('recepcion@santalucia.demo'), c = conv('+593990008001');
  assert.equal((await call('POST', `/api/conversations/${c.id}/send-file`, { name: 'x.exe', data: Buffer.from('MZ....').toString('base64') }, r)).status, 400);
  const ok = await call('POST', `/api/conversations/${c.id}/send-file`, { name: 'indicaciones.pdf', caption: 'Sus indicaciones', data: PDF.toString('base64') }, r);
  assert.equal(ok.status, 200);
  assert.equal(uploads, 1);
  assert.equal(sent[0].type, 'document'); assert.equal(sent[0].document.id, '777000'); assert.equal(sent[0].document.filename, 'indicaciones.pdf'); assert.equal(sent[0].document.caption, 'Sus indicaciones');
  const last = one<any>(db, `SELECT g.sender, g.body, d.mime FROM messages g JOIN media d ON d.message_id = g.id WHERE g.conversation_id = ? ORDER BY g.id DESC LIMIT 1`, c.id);
  assert.equal(last.sender, 'staff'); assert.equal(last.mime, 'application/pdf');
});

test('los archivos se borran a los 90 días, al borrar pruebas y al anonimizar', async () => {
  const before = one<any>(db, 'SELECT COUNT(*) n FROM media WHERE deleted_at IS NULL').n;
  assert.ok(before >= 4);
  assert.equal(purgeOldMedia(db, Date.now() + 91 * 86400000) >= before, true);
  assert.equal(one<any>(db, 'SELECT COUNT(*) n FROM media WHERE deleted_at IS NULL').n, 0);
  assert.equal(readdirSync(join(dir, '1')).length, 0);
  const r = await login('recepcion@santalucia.demo'), id = one<any>(db, 'SELECT id FROM media LIMIT 1').id;
  assert.equal((await call('GET', `/api/media/${id}`, undefined, r)).status, 404);
  await processWebhook(db, parseWebhook(msg('593990008004', 'image', { id: '100001', mime_type: 'image/jpeg' })));
  assert.equal(readdirSync(join(dir, '1')).length, 1);
  resetPatientData(db, 1);
  assert.equal(readdirSync(join(dir, '1')).length, 0);
  assert.equal(existsSync(dir), true);
});
