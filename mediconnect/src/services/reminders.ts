import type { DB } from '../db.ts';
import { all, run } from '../db.ts';
import { humanDate, minutesBetween, nowLocal } from '../util.ts';
import type { Clinic } from './clinic.ts';
import { allClinics } from './clinic.ts';
import { getOrCreateConversation, logMessage } from './conversations.ts';

/**
 * Genera los recordatorios pendientes de una clínica. En producción el mensaje debe enviarse con una
 * plantilla aprobada de WhatsApp (fuera de la ventana de 24 h). Aquí se registra en la conversación.
 */
export function runRemindersForClinic(db: DB, clinic: Clinic, now = nowLocal(clinic.timezone)): number {
  const due = all<any>(db, `SELECT a.id, a.start_at, p.phone, p.name, p.is_holder, d.name AS doctor_name FROM appointments a
    JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id
    JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
    WHERE a.clinic_id = ? AND a.status = 'scheduled' AND a.reminder_sent = 0 AND a.start_at > ? AND p.anonymized = 0`, clinic.id, now)
    .filter((a) => minutesBetween(now, a.start_at) <= clinic.settings.reminder_hours * 60);
  for (const a of due) {
    const conv = getOrCreateConversation(db, clinic.id, a.phone, new Date().toISOString());
    const first = (a.name ?? '').split(' ')[0];
    const intro = a.is_holder ? `Hola${first ? ' ' + first : ''}, te recordamos tu cita con` : `Hola, te recordamos la cita de *${a.name}* con`;
    logMessage(db, clinic.id, conv.id, {
      direction: 'out', sender: 'bot', kind: 'reminder',
      body: `🔔 *Recordatorio de cita* — ${clinic.name}\n${intro} ${a.doctor_name}: *${humanDate(a.start_at)}*.\nResponde *CONFIRMO* para confirmar, *REAGENDAR* para cambiarla o *CANCELAR* para anularla.`,
    });
    run(db, 'UPDATE appointments SET reminder_sent = 1 WHERE clinic_id = ? AND id = ?', clinic.id, a.id);
  }
  return due.length;
}

export const runAllReminders = (db: DB): number => allClinics(db).reduce((n, c) => n + runRemindersForClinic(db, c), 0);
