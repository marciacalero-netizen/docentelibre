// Borra los datos de pacientes de una clínica (conversaciones, pacientes, citas, alertas, encuestas) y conserva la
// configuración: médicos, especialidades, horarios, bloqueos, usuarios, plantillas y avisos. Se usa para empezar limpio
// al pasar del número de pruebas al número real. Las citas que llegaron a Google Calendar se dejan en cola para borrarlas
// de los calendarios (el servidor las procesa en el siguiente minuto).
import type { DB } from '../db.ts';
import { one, run, tx } from '../db.ts';
import { nowIso } from '../util.ts';

const TABLES = ['messages', 'surveys', 'notifications', 'conversations', 'appointments', 'patients'] as const;

export function patientDataCounts(db: DB, clinicId: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = one<{ n: number }>(db, `SELECT COUNT(*) n FROM ${t} WHERE clinic_id = ?`, clinicId)!.n;
  out.calendar_events = one<{ n: number }>(db, 'SELECT COUNT(*) n FROM appointments WHERE clinic_id = ? AND gcal_event_id IS NOT NULL', clinicId)!.n;
  return out;
}

export function resetPatientData(db: DB, clinicId: number): Record<string, number> {
  const before = patientDataCounts(db, clinicId);
  tx(db, () => {
    // Pendientes de crear o actualizar en Google: ya no hacen falta. Lo que sí llegó a Google se borra de allá.
    run(db, `DELETE FROM calendar_outbox WHERE clinic_id = ? AND (done = 1 OR action = 'upsert')`, clinicId);
    run(db, `INSERT INTO calendar_outbox (clinic_id, appointment_id, action, calendar_id, event_id, created_at)
      SELECT clinic_id, id, 'delete', gcal_calendar_id, gcal_event_id, ? FROM appointments
      WHERE clinic_id = ? AND gcal_event_id IS NOT NULL AND gcal_calendar_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM calendar_outbox o WHERE o.clinic_id = appointments.clinic_id AND o.action = 'delete' AND o.event_id = appointments.gcal_event_id)`, nowIso(), clinicId);
    for (const t of TABLES) run(db, `DELETE FROM ${t} WHERE clinic_id = ?`, clinicId);
  });
  return before;
}
