import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, one, run, all } from '../src/db.ts';
import { seedDemo } from '../src/seed.ts';
import { handleIncoming } from '../src/agent/engine.ts';
import { patientDataCounts, resetPatientData } from '../src/services/reset.ts';

test('borrar pruebas: elimina datos de pacientes, conserva la configuración y deja en cola el borrado en Google Calendar', () => {
  const db = openDb(':memory:'); seedDemo(db);
  handleIncoming(db, 1, '+593990005001', 'quiero hablar con una persona');
  const appt = one<any>(db, `SELECT id FROM appointments WHERE clinic_id = 1 AND status = 'scheduled' LIMIT 1`).id;
  run(db, `UPDATE appointments SET gcal_event_id = 'ev1', gcal_calendar_id = 'cal@x' WHERE id = ?`, appt);
  run(db, `INSERT INTO calendar_outbox (clinic_id, appointment_id, action, created_at) VALUES (1, ?, 'upsert', 'x')`, appt);
  run(db, `INSERT INTO blocks (clinic_id, doctor_id, start_at, end_at, reason, created_at) SELECT 1, id, '2026-11-01T00:00', '2026-11-02T00:00', 'Vacaciones', 'x' FROM doctors WHERE clinic_id = 1 LIMIT 1`);
  const keep = (t: string) => one<any>(db, `SELECT COUNT(*) n FROM ${t} WHERE clinic_id = 1`).n;
  const before = { doctors: keep('doctors'), specialties: keep('specialties'), users: keep('users'), blocks: keep('blocks') };
  const otherClinic = patientDataCounts(db, 2);
  assert.ok(patientDataCounts(db, 1).patients > 0);

  const c = resetPatientData(db, 1);
  assert.ok(c.patients > 0 && c.conversations > 0 && c.calendar_events === 1);
  const after = patientDataCounts(db, 1);
  for (const k of ['patients', 'conversations', 'messages', 'appointments', 'notifications', 'surveys']) assert.equal(after[k], 0, k);
  assert.deepEqual({ doctors: keep('doctors'), specialties: keep('specialties'), users: keep('users'), blocks: keep('blocks') }, before);
  assert.deepEqual(patientDataCounts(db, 2), otherClinic);   // otra clínica intacta
  const q = all<any>(db, 'SELECT action, calendar_id, event_id, done FROM calendar_outbox WHERE clinic_id = 1');
  assert.deepEqual(q.map((r) => ({ ...r })), [{ action: 'delete', calendar_id: 'cal@x', event_id: 'ev1', done: 0 }]);
  // después del borrado Gia atiende normal a un número nuevo
  assert.ok(handleIncoming(db, 1, '+593990005002', 'hola').replies.length > 0);
});
