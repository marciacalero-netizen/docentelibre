import type { DB } from '../db.ts';
import { one, run } from '../db.ts';
import { addMinutes, nowIso } from '../util.ts';
import type { Clinic } from './clinic.ts';
import { doctorPrice, getDoctor } from './clinic.ts';
import { isSlotFree } from './availability.ts';
import { enqueueCalendar } from '../integrations/google-calendar.ts';

export type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export function createAppointment(db: DB, clinic: Clinic, a: { doctorId: number; patientId: number; start: string; source: string; ignoreNotice?: boolean }): Result<{ id: number }> {
  const doctor = getDoctor(db, clinic.id, a.doctorId);
  if (!doctor || !doctor.active) return { ok: false, error: 'Médico no disponible' };
  if (!one(db, 'SELECT id FROM patients WHERE clinic_id = ? AND id = ?', clinic.id, a.patientId)) return { ok: false, error: 'Paciente no encontrado' };
  if (!isSlotFree(db, clinic, doctor.id, a.start, { ignoreNotice: a.ignoreNotice })) return { ok: false, error: 'Ese horario ya no está disponible' };
  const end = addMinutes(a.start, doctor.slot_minutes);
  const clash = one(db, `SELECT id FROM appointments WHERE clinic_id = ? AND patient_id = ? AND status = 'scheduled' AND start_at < ? AND end_at > ?`, clinic.id, a.patientId, end, a.start);
  if (clash) return { ok: false, error: 'El paciente ya tiene una cita en ese horario' };
  const r = run(db, `INSERT INTO appointments (clinic_id, doctor_id, patient_id, start_at, end_at, source, price, created_at) VALUES (?,?,?,?,?,?,?,?)`,
    clinic.id, doctor.id, a.patientId, a.start, end, a.source, doctorPrice(doctor), nowIso());
  const id = Number(r.lastInsertRowid);
  enqueueCalendar(db, clinic.id, id, 'upsert');
  return { ok: true, id };
}

export function cancelAppointment(db: DB, clinicId: number, id: number): Result {
  const r = run(db, `UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE clinic_id = ? AND id = ? AND status = 'scheduled'`, nowIso(), clinicId, id);
  if (r.changes) enqueueCalendar(db, clinicId, id, 'delete');
  return r.changes ? { ok: true } : { ok: false, error: 'La cita no existe o ya no está activa' };
}

export function rescheduleAppointment(db: DB, clinic: Clinic, id: number, start: string, opts: { ignoreNotice?: boolean } = {}): Result {
  const a = one<any>(db, `SELECT * FROM appointments WHERE clinic_id = ? AND id = ? AND status = 'scheduled'`, clinic.id, id);
  if (!a) return { ok: false, error: 'La cita no existe o ya no está activa' };
  const doctor = getDoctor(db, clinic.id, a.doctor_id)!;
  if (!isSlotFree(db, clinic, a.doctor_id, start, { excludeAppointmentId: id, ignoreNotice: opts.ignoreNotice })) return { ok: false, error: 'Ese horario ya no está disponible' };
  run(db, 'UPDATE appointments SET start_at = ?, end_at = ?, confirmed = 0, reminder_sent = 0 WHERE clinic_id = ? AND id = ?', start, addMinutes(start, doctor.slot_minutes), clinic.id, id);
  enqueueCalendar(db, clinic.id, id, 'upsert');
  return { ok: true };
}

export function setAppointmentStatus(db: DB, clinicId: number, id: number, status: 'completed' | 'no_show' | 'scheduled'): Result {
  const r = run(db, 'UPDATE appointments SET status = ? WHERE clinic_id = ? AND id = ? AND status != \'cancelled\'', status, clinicId, id);
  return r.changes ? { ok: true } : { ok: false, error: 'Cita no encontrada o cancelada' };
}
