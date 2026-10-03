import type { DB } from '../db.ts';
import { all, one } from '../db.ts';
import { addDays, nowLocal } from '../util.ts';
import type { Clinic } from './clinic.ts';

export function clinicStats(db: DB, clinic: Clinic) {
  const id = clinic.id;
  const today = nowLocal(clinic.timezone).slice(0, 10);
  const d30 = addDays(today, -30);
  const count = (sql: string, ...p: any[]) => one<{ n: number }>(db, sql, ...p)!.n;
  const apptsMonth = all<{ status: string; n: number }>(db, `SELECT status, COUNT(*) n FROM appointments WHERE clinic_id = ? AND start_at >= ? AND start_at < ? GROUP BY status`, id, d30, addDays(today, 1));
  const total30 = apptsMonth.reduce((s, r) => s + r.n, 0);
  const pick = (st: string) => apptsMonth.find((r) => r.status === st)?.n ?? 0;
  const convs30 = count('SELECT COUNT(*) n FROM conversations WHERE clinic_id = ? AND last_message_at >= ?', id, d30);
  const handoffs30 = count('SELECT COUNT(*) n FROM conversations WHERE clinic_id = ? AND last_message_at >= ? AND had_handoff = 1', id, d30);
  return {
    kpis: {
      patients: count('SELECT COUNT(*) n FROM patients WHERE clinic_id = ? AND anonymized = 0', id),
      appointments_30d: total30,
      upcoming: count(`SELECT COUNT(*) n FROM appointments WHERE clinic_id = ? AND status = 'scheduled' AND start_at >= ?`, id, today),
      cancel_rate: total30 ? Math.round((pick('cancelled') / total30) * 100) : 0,
      no_show_rate: total30 ? Math.round((pick('no_show') / total30) * 100) : 0,
      conversations_30d: convs30,
      bot_resolved_rate: convs30 ? Math.round(((convs30 - handoffs30) / convs30) * 100) : 0,
      handoffs_30d: handoffs30,
      emergencies_30d: count(`SELECT COUNT(*) n FROM notifications WHERE clinic_id = ? AND type = 'emergency' AND created_at >= ?`, id, d30),
      revenue_30d: one<{ n: number | null }>(db, `SELECT SUM(price) n FROM appointments WHERE clinic_id = ? AND status = 'completed' AND start_at >= ?`, id, d30)?.n ?? 0,
    },
    by_status: apptsMonth,
    by_day: all(db, `SELECT substr(start_at,1,10) day, COUNT(*) n FROM appointments WHERE clinic_id = ? AND status != 'cancelled' AND start_at >= ? AND start_at < ? GROUP BY day ORDER BY day`, id, addDays(today, -13), addDays(today, 1)),
    by_specialty: all(db, `SELECT s.name, COUNT(*) n FROM appointments a JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
      JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
      WHERE a.clinic_id = ? AND a.status != 'cancelled' AND a.start_at >= ? GROUP BY s.name ORDER BY n DESC`, id, d30),
    by_source: all(db, `SELECT source, COUNT(*) n FROM appointments WHERE clinic_id = ? AND start_at >= ? GROUP BY source`, id, d30),
  };
}
