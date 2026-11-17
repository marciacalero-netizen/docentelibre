import type { DB } from '../db.ts';
import { all, run } from '../db.ts';
import { humanDate, minutesBetween, nowLocal } from '../util.ts';
import type { Clinic } from './clinic.ts';
import { allClinics } from './clinic.ts';
import { getOrCreateConversation, logMessage } from './conversations.ts';
import { deliverProactive } from './outbound.ts';

/**
 * Genera los recordatorios pendientes de una clínica: se registran en la conversación y se envían por WhatsApp
 * (texto libre dentro de las 24 h; si no, con la plantilla «recordatorio» aprobada por Meta).
 */
export function runRemindersForClinic(db: DB, clinic: Clinic, now = nowLocal(clinic.timezone)): number {
  const due = all<any>(db, `SELECT a.id, a.start_at, p.phone, p.name, p.is_holder, d.name AS doctor_name, s.name AS specialty_name FROM appointments a
    JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id
    JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
    JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
    WHERE a.clinic_id = ? AND a.status = 'scheduled' AND a.reminder_sent = 0 AND a.start_at > ? AND p.anonymized = 0`, clinic.id, now)
    .filter((a) => minutesBetween(now, a.start_at) <= clinic.settings.reminder_hours * 60);
  for (const a of due) {
    const conv = getOrCreateConversation(db, clinic.id, a.phone, new Date().toISOString());
    const first = (a.name ?? '').split(' ')[0];
    const who = clinic.settings.show_doctor_names === false ? `de ${a.specialty_name}` : `con ${a.doctor_name}`;   // sin nombres: solo la especialidad
    const intro = a.is_holder ? `Hola${first ? ' ' + first : ''}, le recordamos su cita ${who}` : `Hola, le recordamos la cita de *${a.name}* ${who}`;
    const text = `🔔 *Recordatorio de cita* — ${clinic.name}\n${intro}: *${humanDate(a.start_at)}*.\nResponda *CONFIRMO* para confirmar, *REAGENDAR* para cambiarla o *CANCELAR* para anularla.`;
    logMessage(db, clinic.id, conv.id, { direction: 'out', sender: 'bot', kind: 'reminder', body: text });
    run(db, 'UPDATE appointments SET reminder_sent = 1 WHERE clinic_id = ? AND id = ?', clinic.id, a.id);   // antes de enviar: nunca se duplica
    // Plantilla «recordatorio»: {{1}} paciente, {{2}} especialidad (o médico), {{3}} centro, {{4}} fecha y hora
    const label = clinic.settings.show_doctor_names === false ? a.specialty_name : `${a.doctor_name} (${a.specialty_name})`;
    deliverProactive(db, clinic, { conversationId: conv.id, phone: a.phone, text, template: 'reminder', params: [a.name || 'paciente', label, clinic.name, humanDate(a.start_at)], what: 'Recordatorio de cita', alert: true })
      .catch((e) => console.error('[recordatorios]', e.message));
  }
  return due.length;
}

export const runAllReminders = (db: DB): number => allClinics(db).reduce((n, c) => n + runRemindersForClinic(db, c), 0);
