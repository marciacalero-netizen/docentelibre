// Sincronización de UN SOLO SENTIDO: las citas de MediConnect se crean/actualizan/borran en Google Calendar.
// Autenticación con cuenta de servicio (sin pantallas de permiso): cada calendario se comparte con el correo
// de la cuenta de servicio. DESACTIVADO por defecto. Ver docs/GOOGLE_CALENDAR.md.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { getClinic } from '../services/clinic.ts';
import type { Clinic } from '../services/clinic.ts';
import { nowIso } from '../util.ts';

const MAX_ATTEMPTS = 8;
const apiBase = (): string => process.env.GOOGLE_API_BASE ?? 'https://www.googleapis.com/calendar/v3';

export interface ServiceAccount { client_email: string; private_key: string; token_uri: string }

export function loadServiceAccount(): ServiceAccount | null {
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? new URL('../../config/google-service-account.json', import.meta.url).pathname;
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key, token_uri: process.env.GOOGLE_TOKEN_URL ?? j.token_uri ?? 'https://oauth2.googleapis.com/token' };
  } catch { return null; }
}

const b64 = (v: string | Buffer): string => Buffer.from(v).toString('base64url');
let cache: { key: string; token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cache && cache.key === sa.client_email && cache.exp > Date.now() + 60_000) return cache.token;
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: sa.token_uri, iat, exp: iat + 3600 }))}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }), signal: AbortSignal.timeout(15000) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`Google rechazó las credenciales (${res.status}): ${j.error_description ?? j.error ?? 'sin detalle'}`);
  cache = { key: sa.client_email, token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

class GoogleError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }

async function gcal(sa: ServiceAccount, method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${apiBase()}${path}`, { method, headers: { Authorization: `Bearer ${await accessToken(sa)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  if (res.status === 204) return {};
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const why = res.status === 404 ? 'no se encontró el calendario o el evento (¿ID correcto y calendario compartido con la cuenta de servicio?)' : res.status === 403 ? 'sin permiso (comparta el calendario con la cuenta de servicio con «Hacer cambios en eventos»)' : (j.error?.message ?? 'error de Google');
    throw new GoogleError(res.status, `Google Calendar ${res.status}: ${why}`);
  }
  return j;
}

// ───────── cola ─────────
let wake: (() => void) | null = null;
/** El servidor registra aquí cómo despertar la sincronización cuando hay algo nuevo en la cola. */
export const setCalendarWake = (f: (() => void) | null): void => { wake = f; };

export function enqueueCalendar(db: DB, clinicId: number, appointmentId: number, action: 'upsert' | 'delete'): void {
  const clinic = getClinic(db, clinicId);
  if (!clinic?.settings.google_calendar.enabled) return;
  const a = one<any>(db, 'SELECT gcal_event_id, gcal_calendar_id FROM appointments WHERE clinic_id = ? AND id = ?', clinicId, appointmentId);
  if (!a) return;
  if (action === 'delete') {
    run(db, `UPDATE calendar_outbox SET done = 1 WHERE clinic_id = ? AND appointment_id = ? AND action = 'upsert' AND done = 0`, clinicId, appointmentId);
    if (!a.gcal_event_id) return;   // nunca llegó a Google: nada que borrar
    run(db, `INSERT INTO calendar_outbox (clinic_id, appointment_id, action, calendar_id, event_id, created_at) VALUES (?,?,?,?,?,?)`, clinicId, appointmentId, 'delete', a.gcal_calendar_id, a.gcal_event_id, nowIso());
  } else if (!one(db, `SELECT id FROM calendar_outbox WHERE clinic_id = ? AND appointment_id = ? AND action = 'upsert' AND done = 0`, clinicId, appointmentId)) {
    run(db, `INSERT INTO calendar_outbox (clinic_id, appointment_id, action, created_at) VALUES (?,?,?,?)`, clinicId, appointmentId, 'upsert', nowIso());
  }
  wake?.();
}

const initials = (n: string): string => n.split(' ').filter(Boolean).map((w) => w[0].toUpperCase() + '.').join('');

function eventBody(clinic: Clinic, a: any): any {
  const who = a.patient_name ? (clinic.settings.google_calendar.title_style === 'initials' ? initials(a.patient_name) : a.patient_name) : 'Paciente';
  const tz = clinic.timezone;
  return {
    summary: `${a.confirmed ? '✔ ' : ''}${who} — ${a.specialty_name}`,
    description: `Cita agendada por MediConnect (n.º ${a.id}, origen: ${a.source}).\nMédico: ${a.doctor_name}.${a.confirmed ? '\nAsistencia confirmada por el paciente.' : ''}\nAdministre la cita desde el panel de MediConnect.`,
    location: [clinic.address, clinic.city].filter(Boolean).join(', ') || undefined,
    start: { dateTime: `${a.start_at}:00`, timeZone: tz }, end: { dateTime: `${a.end_at}:00`, timeZone: tz },
    extendedProperties: { private: { mediconnect_appointment_id: String(a.id) } },
  };
}

async function processRow(db: DB, sa: ServiceAccount, row: any): Promise<void> {
  const enc = encodeURIComponent;
  if (row.action === 'delete') {
    try { await gcal(sa, 'DELETE', `/calendars/${enc(row.calendar_id)}/events/${enc(row.event_id)}`); }
    catch (e) { if (!(e instanceof GoogleError && (e.status === 404 || e.status === 410))) throw e; }   // ya no existe: listo
    run(db, 'UPDATE appointments SET gcal_event_id = NULL, gcal_calendar_id = NULL WHERE clinic_id = ? AND id = ? AND gcal_event_id = ?', row.clinic_id, row.appointment_id, row.event_id);
    return;
  }
  const clinic = getClinic(db, row.clinic_id)!;
  const a = one<any>(db, `SELECT a.*, p.name AS patient_name, d.name AS doctor_name, d.calendar_id AS doctor_calendar, s.name AS specialty_name FROM appointments a
    JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id
    JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
    JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
    WHERE a.clinic_id = ? AND a.id = ?`, row.clinic_id, row.appointment_id);
  if (!a || a.status === 'cancelled') return;   // la cancelación la maneja la acción 'delete'
  const calendar = (a.doctor_calendar || clinic.settings.google_calendar.default_calendar_id || '').trim();
  if (!calendar) throw new Error('Falta el ID del calendario: indíquelo en el médico o como calendario predeterminado (Configuración).');
  const body = eventBody(clinic, a);
  if (a.gcal_event_id && a.gcal_calendar_id && a.gcal_calendar_id !== calendar) {   // el médico cambió de calendario: se mueve
    try { await gcal(sa, 'DELETE', `/calendars/${enc(a.gcal_calendar_id)}/events/${enc(a.gcal_event_id)}`); } catch { /* si ya no existe, no importa */ }
    a.gcal_event_id = null;
  }
  let ev: any;
  if (a.gcal_event_id) {
    try { ev = await gcal(sa, 'PUT', `/calendars/${enc(calendar)}/events/${enc(a.gcal_event_id)}`, body); }
    catch (e) { if (e instanceof GoogleError && (e.status === 404 || e.status === 410)) ev = await gcal(sa, 'POST', `/calendars/${enc(calendar)}/events`, body); else throw e; }   // lo borraron a mano: se recrea
  } else {
    ev = await gcal(sa, 'POST', `/calendars/${enc(calendar)}/events`, body);
  }
  run(db, 'UPDATE appointments SET gcal_event_id = ?, gcal_calendar_id = ? WHERE clinic_id = ? AND id = ?', ev.id, calendar, row.clinic_id, row.appointment_id);
}

let running = false;
export interface SyncResult { ok: boolean; processed: number; failed: number; pending: number; error?: string }

/** Procesa la cola (hasta 50 elementos). Si `retryFailed`, vuelve a intentar los que agotaron sus reintentos. */
export async function syncOutbox(db: DB, opts: { retryFailed?: boolean } = {}): Promise<SyncResult> {
  const pending = () => one<{ n: number }>(db, 'SELECT COUNT(*) n FROM calendar_outbox WHERE done = 0')!.n;
  if (running) return { ok: true, processed: 0, failed: 0, pending: pending() };
  running = true;
  try {
    if (opts.retryFailed) run(db, 'UPDATE calendar_outbox SET attempts = 0 WHERE done = 0');
    const rows = all<any>(db, `SELECT * FROM calendar_outbox WHERE done = 0 AND attempts < ${MAX_ATTEMPTS} ORDER BY id LIMIT 50`);
    if (!rows.length) return { ok: true, processed: 0, failed: 0, pending: pending() };
    const sa = loadServiceAccount();
    if (!sa) return { ok: false, processed: 0, failed: 0, pending: pending(), error: 'No se encontró la clave de la cuenta de servicio (config/google-service-account.json).' };
    let processed = 0, failed = 0;
    for (const row of rows) {
      try { await processRow(db, sa, row); run(db, 'UPDATE calendar_outbox SET done = 1, last_error = NULL WHERE id = ?', row.id); processed++; }
      catch (e) { failed++; run(db, 'UPDATE calendar_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', (e as Error).message.slice(0, 300), row.id); }
    }
    return { ok: failed === 0, processed, failed, pending: pending() };
  } finally { running = false; }
}

export function calendarStatus(db: DB, clinic: Clinic) {
  const sa = loadServiceAccount();
  const q = (sql: string) => one<{ n: number }>(db, sql, clinic.id)!.n;
  return {
    enabled: clinic.settings.google_calendar.enabled,
    key_found: !!sa, service_account_email: sa?.client_email ?? null,
    default_calendar_id: clinic.settings.google_calendar.default_calendar_id,
    pending: q('SELECT COUNT(*) n FROM calendar_outbox WHERE clinic_id = ? AND done = 0'),
    gave_up: q(`SELECT COUNT(*) n FROM calendar_outbox WHERE clinic_id = ? AND done = 0 AND attempts >= ${MAX_ATTEMPTS}`),
    synced: q('SELECT COUNT(*) n FROM appointments WHERE clinic_id = ? AND gcal_event_id IS NOT NULL'),
    last_error: one<{ last_error: string }>(db, 'SELECT last_error FROM calendar_outbox WHERE clinic_id = ? AND done = 0 AND last_error IS NOT NULL ORDER BY id DESC LIMIT 1', clinic.id)?.last_error ?? null,
  };
}

/** Prueba de acceso a un calendario (lista 1 evento). */
export async function testCalendar(calendarId: string): Promise<{ ok: boolean; message: string }> {
  const sa = loadServiceAccount();
  if (!sa) return { ok: false, message: 'No se encontró la clave de la cuenta de servicio (config/google-service-account.json).' };
  if (!calendarId.trim()) return { ok: false, message: 'Falta el ID del calendario.' };
  try { await gcal(sa, 'GET', `/calendars/${encodeURIComponent(calendarId.trim())}/events?maxResults=1`); return { ok: true, message: 'Conexión correcta: el calendario es accesible.' }; }
  catch (e) { return { ok: false, message: (e as Error).message }; }
}
