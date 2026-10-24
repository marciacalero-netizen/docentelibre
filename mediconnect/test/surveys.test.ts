import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, one, all, run } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { handleIncoming, parseRating } from '../src/agent/engine.ts';
import { getClinic } from '../src/services/clinic.ts';
import { findOrCreateByPhoneAndName } from '../src/services/patients.ts';
import { setAppointmentStatus } from '../src/services/appointments.ts';
import { runSurveysForClinic, surveyStats } from '../src/services/surveys.ts';
import { runRemindersForClinic } from '../src/services/reminders.ts';
import { setRetryDelay, setTransport, type HttpResult } from '../src/channels/whatsapp.ts';

// 10:00 en Guayaquil (UTC-5): dentro del horario de envío de la encuesta
const NOW = new Date('2026-10-14T15:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600000).toISOString();

function setup() {
  const db = openDb(':memory:'); seedDemo(db);
  return db;
}
let seq = 0;
function completed(db: any, phone: string, name: string, h: number, clinicId = 1): number {
  const pid = findOrCreateByPhoneAndName(db, clinicId, phone, name);
  const doc = one<any>(db, 'SELECT id FROM doctors WHERE clinic_id = ? AND active = 1 ORDER BY id LIMIT 1', clinicId);
  const start = `2026-09-${String(10 + (++seq % 15)).padStart(2, '0')}T08:${String(seq % 60).padStart(2, '0')}`;
  const id = Number(run(db, `INSERT INTO appointments (clinic_id, doctor_id, patient_id, start_at, end_at, status, source, created_at) VALUES (?,?,?,?,?,'scheduled','panel',?)`, clinicId, doc.id, pid, start, start, hoursAgo(48)).lastInsertRowid);
  assert.ok(setAppointmentStatus(db, clinicId, id, 'completed').ok);
  run(db, 'UPDATE appointments SET completed_at = ? WHERE id = ?', hoursAgo(h), id);
  return id;
}
const lastBot = (db: any, phone: string) => one<any>(db, `SELECT m.body, m.kind FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.patient_phone = ? AND m.sender = 'bot' ORDER BY m.id DESC LIMIT 1`, phone);

test('parseRating: números, estrellas y palabras; lo demás no es calificación', () => {
  for (const [t, r] of [['5', 5], ['1', 1], ['4 estrellas', 4], ['3/5', 3], ['⭐⭐⭐⭐', 4], ['⭐️⭐️', 2], ['cinco', 5], ['Dos!', 2], [' 3 ', 3]] as const) assert.equal(parseRating(t), r, t);
  for (const t of ['6', '0', 'hola', '10', '2 de la tarde', 'quiero agendar 3 citas', '⭐⭐⭐⭐⭐⭐']) assert.equal(parseRating(t), null, t);
});

test('marcar como atendida guarda la hora (desde ahí corre la espera de la encuesta)', () => {
  const db = setup();
  const id = completed(db, '+593990004001', 'Ana Prueba', 0);
  run(db, 'UPDATE appointments SET completed_at = NULL WHERE id = ?', id);
  setAppointmentStatus(db, 1, id, 'completed');
  assert.ok(one<any>(db, 'SELECT completed_at FROM appointments WHERE id = ?', id).completed_at);
});

test('encuesta: se envía 2 h después, calificación baja pide comentario y queda en Estadísticas', () => {
  const db = setup(), clinic = getClinic(db, 1)!, phone = '+593990004002';
  completed(db, phone, 'Luis Prueba', 1);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 0);   // aún no pasan 2 horas
  run(db, `UPDATE appointments SET completed_at = ? WHERE patient_id = (SELECT id FROM patients WHERE phone = ?)`, hoursAgo(2.5), phone);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 1);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 0);   // no se repite
  const m = lastBot(db, phone);
  assert.equal(m.kind, 'survey');
  assert.match(m.body, /del \*1\* \(muy mala\) al \*5\* \(excelente\)/);
  const r1 = handleIncoming(db, 1, phone, '2').replies.join('\n');
  assert.match(r1, /Qué podemos mejorar/);
  const r2 = handleIncoming(db, 1, phone, 'Esperé mucho en recepción').replies.join('\n');
  assert.match(r2, /Gracias por contarnos/);
  const s = one<any>(db, 'SELECT rating, comment, answered_at FROM surveys WHERE phone = ?', phone);
  assert.equal(s.rating, 2); assert.equal(s.comment, 'Esperé mucho en recepción'); assert.ok(s.answered_at);
  const st = surveyStats(db, 1, '2000-01-01');
  assert.equal(st.answered, 1); assert.equal(st.average, 2); assert.equal(st.comments[0].comment, 'Esperé mucho en recepción');
  // después de la encuesta, Gia vuelve a atender normal
  assert.match(handleIncoming(db, 1, phone, 'hola').replies.join('\n'), /menú|ayudar|opci/i);
});

test('encuesta: 5 estrellas agradece sin pedir comentario; otra respuesta se atiende normal', () => {
  const db = setup(), clinic = getClinic(db, 1)!;
  completed(db, '+593990004003', 'Rosa Prueba', 3); completed(db, '+593990004004', 'Juan Prueba', 3);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 2);
  const r = handleIncoming(db, 1, '+593990004003', '5').replies.join('\n');
  assert.match(r, /Muchas gracias por su calificación/); assert.doesNotMatch(r, /mejorar\?/);
  const other = handleIncoming(db, 1, '+593990004004', 'quiero agendar una cita').replies.join('\n');
  assert.doesNotMatch(other, /calificación/);
  assert.equal(one<any>(db, `SELECT rating FROM surveys WHERE phone = '+593990004004'`).rating, null);
});

test('encuesta: una por número cada 7 días (también familiares), fuera de horario, desactivada o cita antigua no se envía', () => {
  const db = setup(), clinic = getClinic(db, 1)!, phone = '+593990004005';
  completed(db, phone, 'Titular Prueba', 3); completed(db, phone, 'Hijo Prueba', 3);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 1);
  assert.equal(one<any>(db, `SELECT COUNT(*) n FROM appointments WHERE survey_sent = 2`).n, 1);
  completed(db, '+593990004006', 'Noche Prueba', 3);
  assert.equal(runSurveysForClinic(db, clinic, new Date('2026-10-15T02:00:00.000Z')), 0);   // 21:00 en Guayaquil
  completed(db, '+593990004007', 'Vieja Prueba', 80);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 1);   // solo la de las 3 h; la de hace 80 h no
  completed(db, '+593990004008', 'Off Prueba', 3);
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.survey_enabled', json('false')) WHERE id = 1`);
  assert.equal(runSurveysForClinic(db, getClinic(db, 1)!, NOW), 0);
});

test('encuesta: no interrumpe un chat atendido por recepción ni un trámite en curso', () => {
  const db = setup(), clinic = getClinic(db, 1)!, phone = '+593990004009';
  handleIncoming(db, 1, phone, 'quiero hablar con una persona');
  completed(db, phone, 'Ocupado Prueba', 3);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 0);
  run(db, `UPDATE conversations SET status = 'bot' WHERE patient_phone = ?`, phone);
  assert.equal(runSurveysForClinic(db, clinic, NOW), 1);
});

// ───────── envío real por WhatsApp (simulado) ─────────
let sent: any[] = [];
let respond: () => HttpResult = () => ({ status: 200, body: {} });
beforeEach(() => {
  sent = []; respond = () => ({ status: 200, body: {} });
  process.env.WHATSAPP_ENABLED = 'true'; process.env.WHATSAPP_TOKEN = 'tok'; setRetryDelay(0);
  setTransport(async (_url, init) => { sent.push(JSON.parse(init.body)); return respond(); });
});
afterEach(() => { setTransport(null); delete process.env.WHATSAPP_ENABLED; delete process.env.WHATSAPP_TOKEN; });
const settle = () => new Promise((r) => setTimeout(r, 30));
const waClinic = (db: any, templates: Record<string, string>) => {
  run(db, `UPDATE clinics SET whatsapp_phone_id = '10987654321' WHERE id = 1`);
  run(db, `UPDATE clinics SET settings = json_set(settings, '$.wa_templates', json(?)) WHERE id = 1`, JSON.stringify({ language: 'es', reminder: '', survey: '', ...templates }));
  return getClinic(db, 1)!;
};

test('envío: dentro de 24 h va como texto; fuera de 24 h con la plantilla y sus variables', async () => {
  const db = setup();
  const clinic = waClinic(db, { survey: 'encuesta_atencion' });
  completed(db, '+593990004010', 'Sin Ventana', 3);
  handleIncoming(db, 1, '+593990004011', 'hola'); completed(db, '+593990004011', 'Con Ventana', 3);
  runSurveysForClinic(db, clinic, NOW);
  await settle();
  const tpl = sent.find((b) => b.type === 'template'), txt = sent.find((b) => b.type === 'text');
  assert.equal(tpl.to, '593990004010');
  assert.equal(tpl.template.name, 'encuesta_atencion');
  assert.equal(tpl.template.language.code, 'es');
  assert.deepEqual(tpl.template.components[0].parameters.map((p: any) => p.text)[0], clinic.name);
  assert.equal(txt.to, '593990004011');
  assert.match(txt.text.body, /¿Cómo fue su atención\?/);
});

test('recordatorio sin plantilla fuera de 24 h: no se envía y avisa a recepción; con plantilla sale', async () => {
  const db = setup();
  let clinic = waClinic(db, {});
  const pid = findOrCreateByPhoneAndName(db, 1, '+593990004012', 'Recordar Prueba');
  const doc = one<any>(db, 'SELECT id FROM doctors WHERE clinic_id = 1 AND active = 1 LIMIT 1');
  run(db, `INSERT INTO appointments (clinic_id, doctor_id, patient_id, start_at, end_at, status, source, created_at) VALUES (1,?,?,'2026-10-15T09:00','2026-10-15T09:30','scheduled','panel',?)`, doc.id, pid, hoursAgo(72));
  runRemindersForClinic(db, clinic, '2026-10-14T10:00');
  await settle();
  assert.equal(sent.filter((b) => b.to === '593990004012').length, 0);
  assert.match(one<any>(db, `SELECT title FROM notifications WHERE type = 'send_failed' ORDER BY id DESC`).title, /Recordatorio de cita no enviado/);
  clinic = waClinic(db, { reminder: 'recordatorio_cita' });
  run(db, `UPDATE appointments SET reminder_sent = 0 WHERE patient_id = ?`, pid);
  runRemindersForClinic(db, clinic, '2026-10-14T10:00');
  await settle();
  const tpl = sent.find((b) => b.to === '593990004012');
  assert.equal(tpl.template.name, 'recordatorio_cita');
  const params = tpl.template.components[0].parameters.map((p: any) => p.text);
  assert.equal(params.length, 4); assert.equal(params[0], 'Recordar Prueba'); assert.equal(params[2], clinic.name); assert.match(params[3], /15 de octubre, 09:00/);
});
