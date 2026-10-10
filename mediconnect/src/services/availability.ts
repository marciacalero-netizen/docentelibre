import type { DB } from '../db.ts';
import { all } from '../db.ts';
import { addDays, addMinutes, minutesBetween, nowLocal, weekday } from '../util.ts';
import type { Clinic } from './clinic.ts';
import { listDoctors } from './clinic.ts';

export interface Slot { doctorId: number; start: string }

/** Todos los horarios libres de los médicos indicados dentro de la ventana de reserva de la clínica. */
export function freeSlots(db: DB, clinic: Clinic, doctorIds: number[], opts: { excludeAppointmentId?: number; ignoreNotice?: boolean; now?: string } = {}): Slot[] {
  const now = opts.now ?? nowLocal(clinic.timezone);
  const minStart = opts.ignoreNotice ? '' : addMinutes(now, clinic.settings.min_notice_hours * 60);
  const today = now.slice(0, 10);
  const lastDay = addDays(today, clinic.settings.booking_window_days);
  const doctors = listDoctors(db, clinic.id).filter((d) => doctorIds.includes(d.id));
  const out: Slot[] = [];
  for (const d of doctors) {
    const scheds = all<{ weekday: number; start_time: string; end_time: string }>(db,
      'SELECT weekday, start_time, end_time FROM schedules WHERE clinic_id = ? AND doctor_id = ?', clinic.id, d.id);
    const booked = all<{ start_at: string; end_at: string }>(db,
      `SELECT start_at, end_at FROM appointments WHERE clinic_id = ? AND doctor_id = ? AND status = 'scheduled'
       AND start_at >= ? AND start_at < ? AND id != ?`, clinic.id, d.id, today, addDays(lastDay, 1), opts.excludeAppointmentId ?? -1);
    for (let n = 0; ; n++) {
      const date = addDays(today, n);
      if (date > lastDay) break;
      for (const s of scheds.filter((x) => x.weekday === weekday(date))) {
        const end = `${date}T${s.end_time}`;
        for (let t = `${date}T${s.start_time}`; minutesBetween(t, end) >= d.slot_minutes; t = addMinutes(t, d.slot_minutes)) {
          if (t < minStart || t < now) continue;
          const tEnd = addMinutes(t, d.slot_minutes);
          if (booked.some((b) => t < b.end_at && tEnd > b.start_at)) continue;
          out.push({ doctorId: d.id, start: t });
        }
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.doctorId - b.doctorId);
}

/** Selecciona opciones variadas para mostrar al paciente: máximo `perDay` por día. */
export function pickOptions(slots: Slot[], offset: number, n: number, perDay = 3): Slot[] {
  const counts = new Map<string, number>();
  const capped = slots.filter((s) => {
    const k = s.start.slice(0, 10);
    const c = (counts.get(k) ?? 0) + 1;
    counts.set(k, c);
    return c <= perDay;
  });
  return capped.slice(offset, offset + n);
}

export const isSlotFree = (db: DB, clinic: Clinic, doctorId: number, start: string, opts: { excludeAppointmentId?: number; ignoreNotice?: boolean } = {}): boolean =>
  freeSlots(db, clinic, [doctorId], opts).some((s) => s.start === start);
