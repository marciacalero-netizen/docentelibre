import type { DB } from '../db.ts';
import { all, one } from '../db.ts';
import { weekday } from '../util.ts';

export interface Settings {
  hours: Record<string, [string, string][]>; // weekday ('0'..'6') -> rangos de atención
  oncall_name: string;
  oncall_whatsapp: string;                   // WhatsApp del personal de guardia (no se realizan llamadas)
  emergency_number: string;                  // Ecuador: 911 (ECU 911)
  reminder_hours: number;
  min_notice_hours: number;
  booking_window_days: number;
  assistant_name: string;                    // p. ej. «SALUD»; vacío = «el asistente virtual»
  results_text: string;                      // respuesta sobre entrega de resultados (privacidad)
}
export interface Clinic {
  id: number; name: string; slug: string; timezone: string;
  address: string | null; city: string | null; maps_url: string | null;
  whatsapp_phone_id: string | null; active: number; settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  hours: { '1': [['08:00', '18:00']], '2': [['08:00', '18:00']], '3': [['08:00', '18:00']], '4': [['08:00', '18:00']], '5': [['08:00', '18:00']], '6': [['08:00', '12:00']], '0': [] },
  oncall_name: '', oncall_whatsapp: '', emergency_number: '911',
  reminder_hours: 24, min_notice_hours: 2, booking_window_days: 14,
  assistant_name: '',
  results_text: 'Por su privacidad *no enviamos resultados por WhatsApp*. Consulte en recepción cómo retirarlos.',
};

export function parseClinic(row: any): Clinic {
  return { ...row, settings: { ...DEFAULT_SETTINGS, ...JSON.parse(row.settings || '{}') } };
}
export const getClinic = (db: DB, id: number): Clinic | undefined => {
  const r = one(db, 'SELECT * FROM clinics WHERE id = ?', id);
  return r ? parseClinic(r) : undefined;
};
export const getClinicByPhoneId = (db: DB, phoneId: string): Clinic | undefined => {
  const r = one(db, 'SELECT * FROM clinics WHERE whatsapp_phone_id = ? AND active = 1', phoneId);
  return r ? parseClinic(r) : undefined;
};
export const allClinics = (db: DB): Clinic[] => all(db, 'SELECT * FROM clinics WHERE active = 1').map(parseClinic);

/** Si la clínica aún no cargó ningún horario se considera abierta (no se afirma «fuera de horario» sin datos). */
export const hoursConfigured = (clinic: Clinic): boolean => Object.values(clinic.settings.hours).some((r) => r.length > 0);

export function isOpen(clinic: Clinic, local: string): boolean {
  if (!hoursConfigured(clinic)) return true;
  const ranges = clinic.settings.hours[String(weekday(local))] ?? [];
  const t = local.slice(11, 16);
  return ranges.some(([a, b]) => t >= a && t < b);
}

export interface Doctor { id: number; clinic_id: number; specialty_id: number; name: string; price: number | null; slot_minutes: number; active: number; specialty_name?: string; specialty_price?: number | null }

export interface Specialty { id: number; clinic_id: number; name: string; description: string | null; price: number | null; active: number; kind: 'appointment' | 'handoff' | 'walkin'; emoji: string | null; keywords: string | null; info: string | null; contact_whatsapp: string | null }

export const listSpecialties = (db: DB, clinicId: number, onlyActive = true): Specialty[] =>
  all<Specialty>(db, `SELECT * FROM specialties WHERE clinic_id = ? ${onlyActive ? 'AND active = 1' : ''} ORDER BY name`, clinicId);

export const listDoctors = (db: DB, clinicId: number, onlyActive = true): Doctor[] =>
  all(db, `SELECT d.*, s.name AS specialty_name, s.price AS specialty_price FROM doctors d
           JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
           WHERE d.clinic_id = ? ${onlyActive ? 'AND d.active = 1 AND s.active = 1' : ''} ORDER BY d.name`, clinicId);

export const getDoctor = (db: DB, clinicId: number, id: number): Doctor | undefined =>
  one(db, `SELECT d.*, s.name AS specialty_name, s.price AS specialty_price FROM doctors d
           JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
           WHERE d.clinic_id = ? AND d.id = ?`, clinicId, id);

export const doctorPrice = (d: Doctor): number | null => d.price ?? d.specialty_price ?? null;
