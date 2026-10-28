// Encuesta de satisfacción: unas horas después de que recepción marca una cita como «Atendida», Gia pide
// una calificación del 1 al 5. Como máximo una encuesta por número cada 7 días. Las respuestas las procesa el
// motor conversacional (flujo «survey»).
import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { nowIso, nowLocal } from '../util.ts';
import type { Clinic } from './clinic.ts';
import { allClinics } from './clinic.ts';
import { getOrCreateConversation, logMessage } from './conversations.ts';
import { deliverProactive } from './outbound.ts';

export const SURVEY_DELAY_H = 2;          // espera tras marcar la cita como atendida
const SEND_FROM = 9, SEND_UNTIL = 20;     // solo se escribe entre las 09:00 y las 20:00 (hora del centro)
const MAX_AGE_H = 72;                     // citas atendidas hace más de 3 días ya no se encuestan
const EVERY_DAYS = 7;                     // una encuesta por número cada 7 días
const ACTIVE_FLOW_MIN = 60;               // si el paciente está a mitad de un trámite reciente, se espera

export const surveyText = (clinic: Clinic, specialty: string): string =>
  `⭐ *¿Cómo fue su atención?* — ${clinic.name}\nGracias por visitarnos en su cita de *${specialty}*. ¿Cómo calificaría la atención recibida?\n\nResponda con un número del *1* (muy mala) al *5* (excelente).`;

export function runSurveysForClinic(db: DB, clinic: Clinic, now = new Date()): number {
  if (!clinic.settings.survey_enabled) return 0;
  const hour = Number(nowLocal(clinic.timezone, now).slice(11, 13));
  if (hour < SEND_FROM || hour >= SEND_UNTIL) return 0;
  const due = all<any>(db, `SELECT a.id, p.phone, s.name AS specialty_name FROM appointments a
    JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id
    JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
    JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
    WHERE a.clinic_id = ? AND a.status = 'completed' AND a.survey_sent = 0 AND a.completed_at <= ? AND a.completed_at >= ? AND p.anonymized = 0
    ORDER BY a.completed_at`, clinic.id, nowIso(new Date(now.getTime() - SURVEY_DELAY_H * 3600000)), nowIso(new Date(now.getTime() - MAX_AGE_H * 3600000)));
  let sent = 0;
  for (const a of due) {
    // Ya se le pidió calificación a este número en los últimos 7 días (incluye otro familiar): no se repite.
    if (one(db, 'SELECT 1 FROM surveys WHERE clinic_id = ? AND phone = ? AND sent_at >= ?', clinic.id, a.phone, nowIso(new Date(now.getTime() - EVERY_DAYS * 86400000)))) {
      run(db, 'UPDATE appointments SET survey_sent = 2 WHERE clinic_id = ? AND id = ?', clinic.id, a.id);
      continue;
    }
    const conv = getOrCreateConversation(db, clinic.id, a.phone, nowIso(now));
    let flow: string | null = null;
    try { flow = JSON.parse(conv.state).flow ?? null; } catch { /* estado vacío */ }
    // Una persona atiende el chat o el paciente está en medio de un trámite: se intenta en la próxima vuelta.
    if (conv.status === 'human' || (flow && Date.parse(conv.last_message_at) > now.getTime() - ACTIVE_FLOW_MIN * 60000)) continue;
    const text = surveyText(clinic, a.specialty_name);
    const surveyId = Number(run(db, 'INSERT INTO surveys (clinic_id, appointment_id, phone, sent_at) VALUES (?,?,?,?)', clinic.id, a.id, a.phone, nowIso(now)).lastInsertRowid);
    run(db, 'UPDATE appointments SET survey_sent = 1 WHERE clinic_id = ? AND id = ?', clinic.id, a.id);
    run(db, 'UPDATE conversations SET state = ? WHERE clinic_id = ? AND id = ?', JSON.stringify({ flow: 'survey', step: 'rating', menu: false, fails: 0, data: { surveyId }, options: [] }), clinic.id, conv.id);
    logMessage(db, clinic.id, conv.id, { direction: 'out', sender: 'bot', kind: 'survey', body: text, at: nowIso(now) });
    // Plantilla «encuesta»: {{1}} centro, {{2}} especialidad
    deliverProactive(db, clinic, { conversationId: conv.id, phone: a.phone, text, template: 'survey', params: [clinic.name, a.specialty_name], what: 'Encuesta de satisfacción', alert: false })
      .catch((e) => console.error('[encuestas]', e.message));
    sent++;
  }
  return sent;
}

export const runAllSurveys = (db: DB, now = new Date()): number => allClinics(db).reduce((n, c) => n + runSurveysForClinic(db, c, now), 0);

/** Resumen para Estadísticas: últimos 30 días. */
export function surveyStats(db: DB, clinicId: number, since: string) {
  const rows = all<{ rating: number; n: number }>(db, 'SELECT rating, COUNT(*) n FROM surveys WHERE clinic_id = ? AND rating IS NOT NULL AND answered_at >= ? GROUP BY rating', clinicId, since);
  const answered = rows.reduce((s, r) => s + r.n, 0);
  return {
    sent: one<{ n: number }>(db, 'SELECT COUNT(*) n FROM surveys WHERE clinic_id = ? AND sent_at >= ?', clinicId, since)!.n,
    answered,
    average: answered ? Math.round((rows.reduce((s, r) => s + r.rating * r.n, 0) / answered) * 10) / 10 : null,
    by_rating: [5, 4, 3, 2, 1].map((r) => ({ rating: r, n: rows.find((x) => x.rating === r)?.n ?? 0 })),
    comments: all(db, `SELECT s.rating, s.comment, s.answered_at, sp.name AS specialty_name, d.name AS doctor_name FROM surveys s
      JOIN appointments a ON a.clinic_id = s.clinic_id AND a.id = s.appointment_id
      JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
      JOIN specialties sp ON sp.clinic_id = d.clinic_id AND sp.id = d.specialty_id
      WHERE s.clinic_id = ? AND s.comment IS NOT NULL AND s.answered_at >= ? ORDER BY s.answered_at DESC LIMIT 20`, clinicId, since),
  };
}
