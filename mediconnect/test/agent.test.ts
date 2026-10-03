import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, all, one, run } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { handleIncoming } from '../src/agent/engine.ts';
import { assessSafety } from '../src/agent/safety.ts';
import { runRemindersForClinic } from '../src/services/reminders.ts';
import { getClinic } from '../src/services/clinic.ts';
import { addMinutes, nowLocal } from '../src/util.ts';

const fresh = () => { const db = openDb(':memory:'); seedDemo(db); return db; };
const talk = (db: any, clinic: number, phone: string, lines: string[]) => lines.map((l) => handleIncoming(db, clinic, phone, l).replies.join('\n'));
const last = (a: string[]) => a[a.length - 1];

test('guardarraíles: emergencias, autolesión y diagnóstico', () => {
  assert.equal(assessSafety('Tengo dolor fuerte en el pecho'), 'emergency');
  assert.equal(assessSafety('mi hijo no puede respirar'), 'emergency');
  assert.equal(assessSafety('mi mamá se desmayó'), 'emergency');
  assert.equal(assessSafety('no puedo respirar bien'), 'emergency');
  assert.equal(assessSafety('me quiero morir'), 'self_harm');
  assert.equal(assessSafety('¿qué tengo si me duele la cabeza?'), 'diagnosis');
  assert.equal(assessSafety('Quiero una cita con pediatría'), null);
});

test('emergencia: orienta al 911, marca la conversación y alerta al personal', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990001111', ['Tengo dolor fuerte en el pecho y me desmayo']);
  assert.match(r, /911/);
  assert.equal(one<any>(db, `SELECT flag FROM conversations WHERE clinic_id=1 AND patient_phone='+593990001111'`).flag, 'emergency');
  assert.ok(one(db, `SELECT id FROM notifications WHERE clinic_id=1 AND type='emergency' AND level='urgent'`));
  assert.doesNotMatch(r, /diagn[oó]stic[ao] es/i);
});

test('no diagnostica ni recomienda medicamentos y ofrece agendar', () => {
  const db = fresh();
  const [r] = talk(db, 1, '+593990001112', ['Me duele la cabeza, ¿qué medicamento puedo tomar?']);
  assert.match(r, /no puedo dar diagn[oó]sticos/i);
  assert.match(r, /agendar/i);
});

test('agendar exige consentimiento y solo pide el nombre (sin datos clínicos)', () => {
  const db = fresh();
  const out = talk(db, 1, '+593990001113', ['Quiero agendar una cita', 'no']);
  assert.match(out[0], /Protecci[oó]n de Datos Personales/);
  assert.match(out[1], /Sin tu autorizaci[oó]n/);
  assert.equal(one(db, `SELECT id FROM patients WHERE clinic_id=1 AND phone='+593990001113'`), undefined);
  const out2 = talk(db, 1, '+593990001114', ['agendar', 'si', '1', '1', '1', '1']);
  assert.match(last(out2), /nombre y apellido/i);
  assert.doesNotMatch(out2.join(' '), /s[ií]ntoma|motivo de consulta|c[eé]dula/i);
});

test('flujo completo: agendar, reagendar y cancelar por WhatsApp', () => {
  const db = fresh();
  const p = '+593990001115';
  const out = talk(db, 1, p, ['Hola', '1', 'si', '1', '1', '1', 'Lucia Mendez Rivas', 'si']);
  assert.match(last(out), /Cita confirmada/);
  const a1 = one<any>(db, `SELECT a.* FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p);
  assert.equal(a1.status, 'scheduled'); assert.equal(a1.source, 'whatsapp');
  assert.equal(one<any>(db, `SELECT name FROM patients WHERE phone=?`, p).name, 'Lucia Mendez Rivas');

  const re = talk(db, 1, p, ['quiero reagendar', '2', 'si']);
  assert.match(last(re), /Cita reagendada/);
  const a2 = one<any>(db, `SELECT * FROM appointments WHERE id=?`, a1.id);
  assert.notEqual(a2.start_at, a1.start_at); assert.equal(a2.doctor_id, a1.doctor_id);

  const ca = talk(db, 1, p, ['cancelar mi cita', 'si']);
  assert.match(last(ca), /cancelada/);
  assert.equal(one<any>(db, `SELECT status FROM appointments WHERE id=?`, a1.id).status, 'cancelled');
});

test('no permite doble reserva del mismo horario', () => {
  const db = fresh();
  talk(db, 1, '+593990002001', ['agendar', 'si', '1', '1', '1', 'Ana Perez Soto']);
  talk(db, 1, '+593990002002', ['agendar', 'si', '1', '1', '1', 'Luis Gil Mora']);
  // ambos eligieron la opción 1: el segundo debe recibir otro horario o un aviso, nunca duplicar
  assert.match(last(talk(db, 1, '+593990002001', ['si'])), /Cita confirmada/);
  assert.match(last(talk(db, 1, '+593990002002', ['si'])), /ya no est[aá] disponible/i);
  const dup = all(db, `SELECT doctor_id, start_at, COUNT(*) n FROM appointments WHERE status='scheduled' GROUP BY doctor_id, start_at HAVING n > 1`);
  assert.equal(dup.length, 0);
});

test('derivación a humano: el bot calla y el personal puede devolver el control', () => {
  const db = fresh();
  const p = '+593990003001';
  const [r1] = talk(db, 1, p, ['quiero hablar con una persona']);
  assert.match(r1, /recepci[oó]n|guardia/i);
  assert.equal(handleIncoming(db, 1, p, 'hola?').replies.length, 0);
  run(db, `UPDATE conversations SET status='bot' WHERE clinic_id=1 AND patient_phone=?`, p);
  assert.ok(handleIncoming(db, 1, p, 'hola').replies.length > 0);
});

test('fuera de horario: se notifica al personal de guardia', () => {
  const db = fresh();
  const sunday = '2026-10-04T22:00';
  handleIncoming(db, 1, '+593990003002', 'recepcionista por favor', { now: sunday });
  const n = one<any>(db, `SELECT * FROM notifications WHERE clinic_id=1 AND type='oncall' ORDER BY id DESC`);
  assert.ok(n); assert.equal(n.target, '+593990009999');
  const msgs = all<any>(db, `SELECT body FROM messages WHERE direction='out' ORDER BY id DESC LIMIT 1`);
  assert.match(msgs[0].body, /fuera de nuestro horario/i);
});

test('información: precios, ubicación y horarios son de la clínica correcta', () => {
  const db = fresh();
  const [price, loc] = talk(db, 2, '+593990004001', ['cuánto cuesta la consulta', 'dónde están ubicados']);
  assert.match(price, /Odontolog[ií]a/); assert.doesNotMatch(price, /Cardiolog[ií]a/);
  assert.match(loc, /Kennedy/); assert.doesNotMatch(loc, /Urdesa/);
});

test('recordatorios: se generan dentro de la ventana y se pueden confirmar', () => {
  const db = fresh();
  const clinic = getClinic(db, 1)!;
  const p = '+593990005001';
  talk(db, 1, p, ['Hola', '1', 'si', '1', '1', '1', 'Maria Torres Vera', 'si']);
  const a = one<any>(db, `SELECT a.id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE p.phone=?`, p);
  run(db, `UPDATE appointments SET start_at = ?, end_at = ? WHERE id = ?`, addMinutes(nowLocal(clinic.timezone), 60 * 5), addMinutes(nowLocal(clinic.timezone), 60 * 5 + 20), a.id);
  assert.ok(runRemindersForClinic(db, clinic) >= 1);
  assert.equal(runRemindersForClinic(db, clinic), 0); // no duplica
  const r = one<any>(db, `SELECT body FROM messages WHERE kind='reminder' ORDER BY id DESC`);
  assert.match(r.body, /Recordatorio de cita/);
  assert.match(last(talk(db, 1, p, ['CONFIRMO'])), /confirmada/i);
  assert.equal(one<any>(db, `SELECT confirmed FROM appointments WHERE id=?`, a.id).confirmed, 1);
});
