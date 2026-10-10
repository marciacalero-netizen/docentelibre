import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize as pnormalize } from 'node:path';
import type { DB } from './db.ts';
import { all, one, openDb, run, tx } from './db.ts';
import { getSession, login, logout, hashPassword, revokeUserSessions, verifyPassword } from './auth.ts';
import type { Session } from './auth.ts';
import { seedDemo } from './seed.ts';
import { handleIncoming } from './agent/engine.ts';
import { getClinic, getDoctor, listDoctors, listSpecialties } from './services/clinic.ts';
import type { Clinic } from './services/clinic.ts';
import { freeSlots } from './services/availability.ts';
import { cancelAppointment, createAppointment, rescheduleAppointment, setAppointmentStatus } from './services/appointments.ts';
import { getMessages, logMessage } from './services/conversations.ts';
import { runAllReminders, runRemindersForClinic } from './services/reminders.ts';
import { clinicStats } from './services/stats.ts';
import { findOrCreateByPhoneAndName } from './services/patients.ts';
import { addDays, normalizePhone, nowIso, nowLocal } from './util.ts';
import { parseWebhook, sendText, verifyChallenge, verifySignature, whatsappConfigProblems, whatsappEnabled } from './channels/whatsapp.ts';
import { processWebhook } from './services/whatsapp-inbound.ts';
import { calendarStatus, enqueueCalendar, setCalendarWake, syncOutbox, testCalendar } from './integrations/google-calendar.ts';

class HttpError extends Error { status: number; constructor(status: number, msg: string) { super(msg); this.status = status; } }
function bad(msg: string, status = 400): never { throw new HttpError(status, msg); }

interface Ctx { db: DB; session: Session; token: string; clinic: Clinic; params: string[]; query: URLSearchParams; body: any }
type Handler = (c: Ctx) => unknown;
const routes: { method: string; re: RegExp; admin: boolean; fn: Handler }[] = [];
const route = (method: string, path: string, fn: Handler, admin = false) =>
  routes.push({ method, re: new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`), admin, fn });

// ───────── validación ─────────
const str = (v: unknown, name: string, max = 200, required = true): string => {
  if (v == null || v === '') { if (required) bad(`Falta el campo «${name}»`); return ''; }
  if (typeof v !== 'string' || v.length > max) bad(`Campo «${name}» inválido`);
  return (v as string).trim();
};
const int = (v: unknown, name: string, min = 0, max = 1e9): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) bad(`Campo «${name}» inválido`);
  return n;
};
const num = (v: unknown, name: string): number | null => {
  if (v === null || v === '' || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100000) bad(`Campo «${name}» inválido`);
  return n;
};
const hhmm = (v: unknown, name: string): string => { const s = str(v, name, 5); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) bad(`Hora «${name}» inválida`); return s; };
const phone = (v: unknown): string => normalizePhone(str(v, 'teléfono', 24)) ?? bad('Teléfono inválido');
const audit = (c: Ctx, action: string, entity: string, id: number | null) =>
  run(c.db, 'INSERT INTO audit_log (clinic_id, user_id, action, entity, entity_id, created_at) VALUES (?,?,?,?,?,?)', c.clinic.id, c.session.userId, action, entity, id, nowIso());

// ───────── sesión / panel ─────────
route('GET', '/api/me', (c) => ({ user: { name: c.session.name, role: c.session.role, must_change: c.session.mustChange }, clinic: { id: c.clinic.id, name: c.clinic.name, timezone: c.clinic.timezone, address: c.clinic.address, city: c.clinic.city, maps_url: c.clinic.maps_url, settings: c.clinic.settings }, today: nowLocal(c.clinic.timezone).slice(0, 10) }));

route('GET', '/api/summary', (c) => {
  const id = c.clinic.id, now = nowLocal(c.clinic.timezone), today = now.slice(0, 10);
  return {
    today, now,
    appointments_today: all(c.db, APPT_SELECT + ` WHERE a.clinic_id = ? AND substr(a.start_at,1,10) = ? ORDER BY a.start_at`, id, today),
    waiting_human: all(c.db, `SELECT c.id, c.patient_phone, c.handoff_reason, c.handoff_area, c.last_message_at, p.name AS patient_name FROM conversations c LEFT JOIN patients p ON p.clinic_id = c.clinic_id AND p.id = c.patient_id WHERE c.clinic_id = ? AND c.status = 'human' ORDER BY c.last_message_at DESC`, id),
    urgent_unread: one<{ n: number }>(c.db, `SELECT COUNT(*) n FROM notifications WHERE clinic_id = ? AND level = 'urgent' AND read = 0`, id)!.n,
    upcoming_count: one<{ n: number }>(c.db, `SELECT COUNT(*) n FROM appointments WHERE clinic_id = ? AND status = 'scheduled' AND start_at >= ?`, id, now)!.n,
    pending_confirmation: one<{ n: number }>(c.db, `SELECT COUNT(*) n FROM appointments WHERE clinic_id = ? AND status = 'scheduled' AND confirmed = 0 AND start_at >= ? AND start_at < ?`, id, now, addDays(today, 3))!.n,
  };
});

// ───────── citas ─────────
const APPT_SELECT = `SELECT a.id, a.start_at, a.end_at, a.status, a.confirmed, a.source, a.price, a.doctor_id, a.patient_id,
  d.name AS doctor_name, s.name AS specialty_name, p.name AS patient_name, p.phone AS patient_phone
  FROM appointments a
  JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
  JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
  JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id`;

route('GET', '/api/appointments', (c) => {
  const from = str(c.query.get('from'), 'from', 10), to = str(c.query.get('to'), 'to', 10);
  const doc = c.query.get('doctor_id');
  return all(c.db, APPT_SELECT + ` WHERE a.clinic_id = ? AND substr(a.start_at,1,10) BETWEEN ? AND ? ${doc ? 'AND a.doctor_id = ?' : ''} ORDER BY a.start_at`, ...[c.clinic.id, from, to, ...(doc ? [int(doc, 'doctor_id')] : [])]);
});
route('GET', '/api/slots', (c) => {
  const date = str(c.query.get('date'), 'date', 10);
  return freeSlots(c.db, c.clinic, [int(c.query.get('doctor_id'), 'doctor_id')], { ignoreNotice: true }).filter((s) => s.start.startsWith(date)).map((s) => s.start.slice(11));
});
route('POST', '/api/appointments', (c) => {
  const doctorId = int(c.body.doctor_id, 'doctor_id');
  const start = `${str(c.body.date, 'fecha', 10)}T${hhmm(c.body.time, 'hora')}`;
  let patientId: number;
  if (c.body.patient_id) {
    patientId = int(c.body.patient_id, 'patient_id');
  } else {
    // Mismo número + otro nombre = familiar del titular (máx. 6 por número).
    const ph = phone(c.body.phone), name = str(c.body.name, 'nombre', 80);
    try { patientId = findOrCreateByPhoneAndName(c.db, c.clinic.id, ph, name); } catch (e) { return bad((e as Error).message, 409); }
  }
  const r = createAppointment(c.db, c.clinic, { doctorId, patientId, start, source: 'panel', ignoreNotice: true });
  if (!r.ok) bad(r.error, 409);
  audit(c, 'create', 'appointment', r.id);
  return { id: r.id };
});
route('PATCH', '/api/appointments/:id', (c) => {
  const id = Number(c.params[0]);
  const action = str(c.body.action, 'action', 20);
  let r;
  if (action === 'cancel') r = cancelAppointment(c.db, c.clinic.id, id);
  else if (action === 'complete') r = setAppointmentStatus(c.db, c.clinic.id, id, 'completed');
  else if (action === 'no_show') r = setAppointmentStatus(c.db, c.clinic.id, id, 'no_show');
  else if (action === 'confirm') { r = run(c.db, `UPDATE appointments SET confirmed = 1 WHERE clinic_id = ? AND id = ? AND status = 'scheduled'`, c.clinic.id, id).changes ? { ok: true as const } : { ok: false as const, error: 'Cita no encontrada' }; if (r.ok) enqueueCalendar(c.db, c.clinic.id, id, 'upsert'); }
  else if (action === 'reschedule') r = rescheduleAppointment(c.db, c.clinic, id, `${str(c.body.date, 'fecha', 10)}T${hhmm(c.body.time, 'hora')}`, { ignoreNotice: true });
  else return bad('Acción inválida');
  if (!r.ok) bad(r.error, 409);
  audit(c, action, 'appointment', id);
  return { ok: true };
});

// ───────── pacientes ─────────
route('GET', '/api/patients', (c) => {
  const q = `%${(c.query.get('q') ?? '').slice(0, 50)}%`;
  return all(c.db, `SELECT p.id, p.name, p.phone, p.consent_at, p.anonymized, p.created_at, p.is_holder,
      (SELECT h.name FROM patients h WHERE h.clinic_id = p.clinic_id AND h.phone = p.phone AND h.is_holder = 1 AND p.is_holder = 0) AS holder_name,
      (SELECT COUNT(*) FROM appointments a WHERE a.clinic_id = p.clinic_id AND a.patient_id = p.id) AS appointments,
      (SELECT MAX(start_at) FROM appointments a WHERE a.clinic_id = p.clinic_id AND a.patient_id = p.id AND a.status != 'cancelled') AS last_visit
    FROM patients p WHERE p.clinic_id = ? AND (p.name LIKE ? OR p.phone LIKE ?) ORDER BY p.name LIMIT 200`, c.clinic.id, q, q);
});
route('GET', '/api/patients/:id', (c) => {
  const id = Number(c.params[0]);
  const p = one<any>(c.db, 'SELECT id, name, phone, consent_at, consent_version, anonymized, is_holder, created_at FROM patients WHERE clinic_id = ? AND id = ?', c.clinic.id, id);
  if (!p) bad('Paciente no encontrado', 404);
  audit(c, 'view', 'patient', id);
  const family = p.anonymized ? [] : all(c.db, 'SELECT id, name, is_holder FROM patients WHERE clinic_id = ? AND phone = ? AND id != ? AND anonymized = 0 ORDER BY is_holder DESC, id', c.clinic.id, p.phone, id);
  return { ...p, family, appointments: all(c.db, APPT_SELECT + ' WHERE a.clinic_id = ? AND a.patient_id = ? ORDER BY a.start_at DESC LIMIT 50', c.clinic.id, id) };
});
route('POST', '/api/patients/:id/anonymize', (c) => {
  // Derecho de supresión (LOPDP). Al anonimizar al TITULAR se eliminan también sus familiares registrados
  // bajo ese número y el contenido de la conversación; al anonimizar a un familiar solo se elimina esa persona.
  const id = Number(c.params[0]);
  const p = one<any>(c.db, 'SELECT phone, is_holder FROM patients WHERE clinic_id = ? AND id = ?', c.clinic.id, id);
  if (!p) bad('Paciente no encontrado', 404);
  const ids: number[] = p.is_holder ? all<{ id: number }>(c.db, 'SELECT id FROM patients WHERE clinic_id = ? AND phone = ?', c.clinic.id, p.phone).map((r) => r.id) : [id];
  tx(c.db, () => {
    if (p.is_holder) {
      const conv = one<any>(c.db, 'SELECT id FROM conversations WHERE clinic_id = ? AND patient_phone = ?', c.clinic.id, p.phone);
      if (conv) {
        run(c.db, `UPDATE messages SET body = '[eliminado por solicitud del titular]' WHERE clinic_id = ? AND conversation_id = ?`, c.clinic.id, conv.id);
        run(c.db, `UPDATE conversations SET patient_phone = ?, patient_id = NULL, state = '{}', status = 'bot' WHERE clinic_id = ? AND id = ?`, `anon-${id}`, c.clinic.id, conv.id);
      }
    }
    for (const pid of ids) {
      for (const a of all<{ id: number }>(c.db, 'SELECT id FROM appointments WHERE clinic_id = ? AND patient_id = ? AND gcal_event_id IS NOT NULL', c.clinic.id, pid)) enqueueCalendar(c.db, c.clinic.id, a.id, 'delete');   // derecho de supresión: también en Google Calendar
      run(c.db, `UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE clinic_id = ? AND patient_id = ? AND status = 'scheduled' AND start_at >= ?`, nowIso(), c.clinic.id, pid, nowLocal(c.clinic.timezone));
      run(c.db, `UPDATE patients SET name = 'Paciente anonimizado', phone = ?, anonymized = 1, consent_at = NULL WHERE clinic_id = ? AND id = ?`, `anon-${pid}`, c.clinic.id, pid);
      audit(c, 'anonymize', 'patient', pid);
    }
  });
  return { ok: true, anonymized: ids.length };
}, true);

// ───────── médicos y especialidades ─────────
route('GET', '/api/specialties', (c) => listSpecialties(c.db, c.clinic.id, false));
const KINDS = ['appointment', 'handoff', 'walkin'];
const specFields = (c: Ctx) => {
  const kind = c.body.kind ?? 'appointment';
  if (!KINDS.includes(kind)) bad('Tipo de servicio inválido');
  return [str(c.body.name, 'nombre', 80), str(c.body.description, 'descripción', 200, false) || null, num(c.body.price, 'precio'), kind, str(c.body.emoji, 'emoji', 8, false) || null, str(c.body.keywords, 'palabras clave', 300, false) || null, str(c.body.info, 'mensaje', 1200, false) || null, c.body.contact_whatsapp ? phone(c.body.contact_whatsapp) : null] as const;
};
route('POST', '/api/specialties', (c) => {
  try {
    return { id: Number(run(c.db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp) VALUES (?,?,?,?,?,?,?,?,?)', c.clinic.id, ...specFields(c)).lastInsertRowid) };
  } catch { return bad('Ya existe una especialidad con ese nombre', 409); }
}, true);
route('PATCH', '/api/specialties/:id', (c) => {
  const r = run(c.db, 'UPDATE specialties SET name = ?, description = ?, price = ?, kind = ?, emoji = ?, keywords = ?, info = ?, contact_whatsapp = ?, active = ? WHERE clinic_id = ? AND id = ?', ...specFields(c), c.body.active ? 1 : 0, c.clinic.id, Number(c.params[0]));
  return r.changes ? { ok: true } : bad('No encontrada', 404);
}, true);

route('GET', '/api/doctors', (c) => listDoctors(c.db, c.clinic.id, false).map((d) => ({ ...d, schedule: all(c.db, 'SELECT weekday, start_time, end_time FROM schedules WHERE clinic_id = ? AND doctor_id = ? ORDER BY weekday, start_time', c.clinic.id, d.id) })));
const doctorFields = (c: Ctx) => {
  const spId = int(c.body.specialty_id, 'especialidad');
  if (!one(c.db, 'SELECT id FROM specialties WHERE clinic_id = ? AND id = ?', c.clinic.id, spId)) bad('Especialidad inválida');
  const cal = str(c.body.calendar_id, 'calendario', 200, false);
  if (cal && !/^[\w.@%+-]+$/.test(cal)) bad('ID de calendario inválido');
  return [spId, str(c.body.name, 'nombre', 80), num(c.body.price, 'precio'), int(c.body.slot_minutes, 'duración', 10, 120), cal || null] as const;
};
route('POST', '/api/doctors', (c) => {
  const [sp, name, price, slot, cal] = doctorFields(c);
  return { id: Number(run(c.db, 'INSERT INTO doctors (clinic_id, specialty_id, name, price, slot_minutes, calendar_id) VALUES (?,?,?,?,?,?)', c.clinic.id, sp, name, price, slot, cal).lastInsertRowid) };
}, true);
route('PATCH', '/api/doctors/:id', (c) => {
  const [sp, name, price, slot, cal] = doctorFields(c);
  const r = run(c.db, 'UPDATE doctors SET specialty_id = ?, name = ?, price = ?, slot_minutes = ?, calendar_id = ?, active = ? WHERE clinic_id = ? AND id = ?', sp, name, price, slot, cal, c.body.active ? 1 : 0, c.clinic.id, Number(c.params[0]));
  return r.changes ? { ok: true } : bad('No encontrado', 404);
}, true);
route('PUT', '/api/doctors/:id/schedule', (c) => {
  const id = Number(c.params[0]);
  if (!getDoctor(c.db, c.clinic.id, id)) bad('No encontrado', 404);
  if (!Array.isArray(c.body.blocks) || c.body.blocks.length > 40) bad('Horario inválido');
  const blocks = c.body.blocks.map((b: any) => ({ weekday: int(b.weekday, 'día', 0, 6), start: hhmm(b.start, 'inicio'), end: hhmm(b.end, 'fin') }));
  if (blocks.some((b: any) => b.start >= b.end)) bad('La hora de inicio debe ser anterior a la de fin');
  tx(c.db, () => {
    run(c.db, 'DELETE FROM schedules WHERE clinic_id = ? AND doctor_id = ?', c.clinic.id, id);
    for (const b of blocks) run(c.db, 'INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)', c.clinic.id, id, b.weekday, b.start, b.end);
  });
  return { ok: true };
}, true);

// ───────── conversaciones ─────────
route('GET', '/api/conversations', (c) => all(c.db, `SELECT c.id, c.patient_phone, c.status, c.flag, c.handoff_reason, c.handoff_area, c.last_message_at, p.name AS patient_name,
    (SELECT body FROM messages m WHERE m.clinic_id = c.clinic_id AND m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body
  FROM conversations c LEFT JOIN patients p ON p.clinic_id = c.clinic_id AND p.id = c.patient_id
  WHERE c.clinic_id = ? ORDER BY (c.status = 'human') DESC, (c.flag IS NOT NULL) DESC, c.last_message_at DESC LIMIT 100`, c.clinic.id));
route('GET', '/api/conversations/:id', (c) => {
  const id = Number(c.params[0]);
  const conv = one<any>(c.db, `SELECT c.id, c.patient_phone, c.status, c.flag, c.handoff_reason, c.handoff_area, p.name AS patient_name FROM conversations c LEFT JOIN patients p ON p.clinic_id = c.clinic_id AND p.id = c.patient_id WHERE c.clinic_id = ? AND c.id = ?`, c.clinic.id, id);
  if (!conv) bad('Conversación no encontrada', 404);
  audit(c, 'view', 'conversation', id);
  return { ...conv, messages: getMessages(c.db, c.clinic.id, id) };
});
const ownConv = (c: Ctx) => one<any>(c.db, 'SELECT id, status FROM conversations WHERE clinic_id = ? AND id = ?', c.clinic.id, Number(c.params[0])) ?? bad('Conversación no encontrada', 404);
route('POST', '/api/conversations/:id/takeover', (c) => { const cv = ownConv(c); run(c.db, `UPDATE conversations SET status = 'human', had_handoff = 1, handoff_reason = COALESCE(handoff_reason, 'Tomada por el personal') WHERE clinic_id = ? AND id = ?`, c.clinic.id, cv.id); return { ok: true }; });
route('POST', '/api/conversations/:id/release', (c) => { const cv = ownConv(c); run(c.db, `UPDATE conversations SET status = 'bot', flag = NULL, handoff_area = NULL, state = '{}' WHERE clinic_id = ? AND id = ?`, c.clinic.id, cv.id); return { ok: true }; });
route('POST', '/api/conversations/:id/reply', async (c) => {
  const cv = ownConv(c);
  const text = str(c.body.text, 'mensaje', 1000);
  run(c.db, `UPDATE conversations SET status = 'human', had_handoff = 1 WHERE clinic_id = ? AND id = ?`, c.clinic.id, cv.id);
  // Con WhatsApp real conectado, la respuesta del panel sale al paciente; si no sale, no se registra como enviada.
  if (whatsappEnabled() && c.clinic.whatsapp_phone_id) {
    const to = one<{ patient_phone: string }>(c.db, 'SELECT patient_phone FROM conversations WHERE clinic_id = ? AND id = ?', c.clinic.id, cv.id)!.patient_phone;
    if (!/^\+\d{8,15}$/.test(to)) bad('Esta conversación no tiene un número al que se pueda escribir');
    try { await sendText(c.clinic.whatsapp_phone_id, to, text); }
    catch (e: any) { console.error(`[whatsapp] ${e.message}`); bad('No se pudo enviar el mensaje por WhatsApp. Si el paciente escribió hace más de 24 horas, WhatsApp solo permite plantillas aprobadas: escríbale desde el celular del centro.', 502); }
  }
  logMessage(c.db, c.clinic.id, cv.id, { direction: 'out', sender: 'staff', body: text });
  return { ok: true };
});

route('GET', '/api/notifications', (c) => all(c.db, 'SELECT * FROM notifications WHERE clinic_id = ? ORDER BY id DESC LIMIT 100', c.clinic.id));
route('POST', '/api/notifications/read-all', (c) => { run(c.db, 'UPDATE notifications SET read = 1 WHERE clinic_id = ?', c.clinic.id); return { ok: true }; });
route('POST', '/api/notifications/:id/read', (c) => { run(c.db, 'UPDATE notifications SET read = 1 WHERE clinic_id = ? AND id = ?', c.clinic.id, Number(c.params[0])); return { ok: true }; });

route('GET', '/api/stats', (c) => clinicStats(c.db, c.clinic), true);

// ───────── configuración y usuarios ─────────
route('PUT', '/api/clinic', (c) => {
  const s = c.body.settings ?? {};
  const hours: Record<string, [string, string][]> = {};
  for (let d = 0; d < 7; d++) {
    const ranges = s.hours?.[String(d)] ?? [];
    if (!Array.isArray(ranges) || ranges.length > 4) bad('Horario inválido');
    hours[String(d)] = ranges.map((r: any) => { const a = hhmm(r[0], 'apertura'), b = hhmm(r[1], 'cierre'); if (a >= b) bad('La apertura debe ser anterior al cierre'); return [a, b]; });
  }
  const settings = {
    ...c.clinic.settings, hours,
    oncall_name: str(s.oncall_name, 'guardia', 80, false), oncall_whatsapp: s.oncall_whatsapp ? phone(s.oncall_whatsapp) : '', reception_whatsapp: s.reception_whatsapp ? phone(s.reception_whatsapp) : '',
    emergency_number: str(s.emergency_number, 'emergencias', 10), reminder_hours: int(s.reminder_hours, 'recordatorio', 1, 168),
    min_notice_hours: int(s.min_notice_hours, 'anticipación', 0, 72), booking_window_days: int(s.booking_window_days, 'ventana', 1, 90),
    google_calendar: (() => {
      const g = s.google_calendar ?? {}, id = str(g.default_calendar_id, 'calendario', 200, false);
      if (id && !/^[\w.@%+-]+$/.test(id)) bad('ID de calendario inválido');
      return { enabled: !!g.enabled, default_calendar_id: id, title_style: g.title_style === 'initials' ? 'initials' as const : 'name' as const };
    })(),
    staff_pause_hours: s.staff_pause_hours === undefined ? c.clinic.settings.staff_pause_hours : int(s.staff_pause_hours, 'pausa del asistente', 1, 72),
    assistant_name: str(s.assistant_name, 'asistente', 40, false), prices_extra: str(s.prices_extra, 'otros valores', 1200, false), results_text: str(s.results_text, 'resultados', 800, false) || c.clinic.settings.results_text,
  };
  run(c.db, 'UPDATE clinics SET name = ?, address = ?, city = ?, maps_url = ?, settings = ? WHERE id = ?', str(c.body.name, 'nombre', 100), str(c.body.address, 'dirección', 200, false) || null, str(c.body.city, 'ciudad', 80, false) || null, str(c.body.maps_url, 'mapa', 300, false) || null, JSON.stringify(settings), c.clinic.id);
  audit(c, 'update', 'clinic', c.clinic.id);
  return { ok: true };
}, true);
route('GET', '/api/users', (c) => all(c.db, 'SELECT id, name, email, role, active, must_change FROM users WHERE clinic_id = ? ORDER BY name', c.clinic.id).map((u: any) => ({ ...u, is_me: u.id === c.session.userId })), true);

// ───────── contraseñas y estado de los usuarios ─────────
const MIN_PASSWORD = 10;
const newPassword = (v: unknown): string => { const p = str(v, 'nueva contraseña', 200); if (p.length < MIN_PASSWORD) bad(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`); return p; };
route('POST', '/api/me/password', (c) => {
  const current = str(c.body.current, 'contraseña actual', 200), next = newPassword(c.body.password);
  const u = one<any>(c.db, 'SELECT password_hash FROM users WHERE clinic_id = ? AND id = ?', c.clinic.id, c.session.userId);
  if (!u || !verifyPassword(current, u.password_hash)) bad('La contraseña actual no es correcta', 403);
  if (next === current) bad('La nueva contraseña debe ser distinta de la actual');
  run(c.db, 'UPDATE users SET password_hash = ?, must_change = 0 WHERE clinic_id = ? AND id = ?', hashPassword(next), c.clinic.id, c.session.userId);
  c.session.mustChange = false;
  revokeUserSessions(c.session.userId, c.token);   // cualquier otra sesión abierta con la clave anterior se cierra
  audit(c, 'password_change', 'user', c.session.userId);
  return { ok: true };
});
route('PATCH', '/api/users/:id', (c) => {
  const id = Number(c.params[0]);
  const u = one<any>(c.db, 'SELECT id, role, active FROM users WHERE clinic_id = ? AND id = ?', c.clinic.id, id);
  if (!u) bad('Usuario no encontrado', 404);
  if (c.body.active !== undefined && !c.body.active) {
    if (id === c.session.userId) bad('No puede desactivar su propio usuario');
    if (u.role === 'admin' && u.active && one<any>(c.db, `SELECT COUNT(*) n FROM users WHERE clinic_id = ? AND role = 'admin' AND active = 1 AND id != ?`, c.clinic.id, id)!.n === 0) bad('Debe quedar al menos un administrador activo');
  }
  if (c.body.password !== undefined) {   // restablecer: queda una clave temporal que la persona debe cambiar al ingresar
    run(c.db, 'UPDATE users SET password_hash = ?, must_change = 1 WHERE clinic_id = ? AND id = ?', hashPassword(newPassword(c.body.password)), c.clinic.id, id);
    audit(c, 'password_reset', 'user', id);
  }
  if (c.body.active !== undefined) { run(c.db, 'UPDATE users SET active = ? WHERE clinic_id = ? AND id = ?', c.body.active ? 1 : 0, c.clinic.id, id); audit(c, c.body.active ? 'activate' : 'deactivate', 'user', id); }
  if (c.body.password !== undefined || (c.body.active !== undefined && !c.body.active)) revokeUserSessions(id);
  return { ok: true };
}, true);
route('POST', '/api/users', (c) => {
  const role = c.body.role === 'admin' ? 'admin' : 'receptionist';
  const pw = str(c.body.password, 'contraseña', 100);
  if (pw.length < 10) bad('La contraseña debe tener al menos 10 caracteres');
  const email = str(c.body.email, 'correo', 120).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) bad('Correo inválido');
  try { run(c.db, 'INSERT INTO users (clinic_id, name, email, password_hash, role, must_change, created_at) VALUES (?,?,?,?,?,1,?)', c.clinic.id, str(c.body.name, 'nombre', 80), email, hashPassword(pw), role, nowIso()); }
  catch { bad('Ese correo ya está registrado', 409); }
  audit(c, 'create', 'user', null);
  return { ok: true };
}, true);

// ───────── Google Calendar (opcional) ─────────
route('GET', '/api/calendar/status', (c) => calendarStatus(c.db, c.clinic), true);
route('POST', '/api/calendar/sync', async (c) => ({ ...(await syncOutbox(c.db, { retryFailed: !!c.body.retry })), status: calendarStatus(c.db, c.clinic) }), true);
route('POST', '/api/calendar/test', async (c) => testCalendar(str(c.body.calendar_id, 'calendario', 200, false)), true);

// ───────── simulador de WhatsApp (sin conexión a WhatsApp real) ─────────
route('POST', '/api/simulator/message', (c) => {
  const r = handleIncoming(c.db, c.clinic.id, phone(c.body.phone), str(c.body.text, 'mensaje', 1000));
  return { conversationId: r.conversationId, status: r.status };
});
route('GET', '/api/simulator/messages', (c) => {
  const conv = one<any>(c.db, 'SELECT id, status, handoff_area FROM conversations WHERE clinic_id = ? AND patient_phone = ?', c.clinic.id, phone(c.query.get('phone')));
  if (!conv) return { status: 'bot', messages: [] };
  return { status: conv.status, area: conv.handoff_area, messages: getMessages(c.db, c.clinic.id, conv.id, Number(c.query.get('after') ?? 0) || 0) };
});
route('POST', '/api/simulator/reset', (c) => {
  run(c.db, `UPDATE conversations SET state = '{}', status = 'bot', flag = NULL WHERE clinic_id = ? AND patient_phone = ?`, c.clinic.id, phone(c.body.phone));
  return { ok: true };
});
route('POST', '/api/jobs/reminders', (c) => ({ sent: runRemindersForClinic(c.db, c.clinic) }));

// ───────── HTTP ─────────
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, { ...SEC_HEADERS, ...(isJson ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}), ...headers });
  res.end(isJson ? JSON.stringify(body) : (body as string | Buffer));
}
/** IP del cliente. Detrás del proxy HTTPS del servidor (TRUST_PROXY=1) se toma la que añade el proxy, solo si la conexión viene de la propia máquina. */
const clientIp = (req: IncomingMessage): string => {
  const remote = req.socket.remoteAddress ?? '';
  const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  const fwd = req.headers['x-forwarded-for'];
  if (process.env.TRUST_PROXY === '1' && local && typeof fwd === 'string' && fwd.trim()) return fwd.split(',').pop()!.trim();
  return remote;
};
const cookieOf = (req: IncomingMessage, name: string): string | undefined => req.headers.cookie?.split(';').map((s) => s.trim().split('=')).find(([k]) => k === name)?.[1];
const readBody = (req: IncomingMessage): Promise<Buffer> => new Promise((ok, fail) => {
  const chunks: Buffer[] = []; let size = 0;
  req.on('data', (d: Buffer) => { size += d.length; if (size > 1e6) { fail(new HttpError(413, 'Solicitud demasiado grande')); req.destroy(); } else chunks.push(d); });
  req.on('end', () => ok(Buffer.concat(chunks)));
  req.on('error', fail);
});

export function createApp(db: DB) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const method = req.method ?? 'GET';

      if (url.pathname === '/webhook/whatsapp') return await webhook(db, req, res, url);

      if (url.pathname === '/api/public') return send(res, 200, { demo: !!one(db, `SELECT 1 FROM users WHERE email LIKE '%.demo'`) });
      if (url.pathname.startsWith('/api/')) {
        if (method !== 'GET' && req.headers['x-requested-with'] !== 'mediconnect') return send(res, 403, { error: 'Solicitud no permitida' });
        const raw = method === 'GET' ? Buffer.alloc(0) : await readBody(req);
        let body: any = {};
        if (raw.length) { try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'JSON inválido' }); } }
        if (url.pathname === '/api/login' && method === 'POST') {
          const r = login(db, String(body.email ?? ''), String(body.password ?? ''), clientIp(req));
          if ('error' in r) return send(res, 401, { error: r.error });
          return send(res, 200, { ok: true }, { 'Set-Cookie': `mc_session=${r.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
        }
        if (url.pathname === '/api/logout' && method === 'POST') { logout(cookieOf(req, 'mc_session')); return send(res, 200, { ok: true }, { 'Set-Cookie': 'mc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' }); }
        const session = getSession(cookieOf(req, 'mc_session'));
        if (!session) return send(res, 401, { error: 'Sesión no iniciada' });
        // El tenant sale SIEMPRE de la sesión, nunca de parámetros de la solicitud.
        const clinic = getClinic(db, session.clinicId);
        if (!clinic) return send(res, 401, { error: 'Clínica no disponible' });
        // Con clave temporal solo se puede ver quién es y cambiarla
        if (session.mustChange && !['/api/me', '/api/me/password'].includes(url.pathname)) return send(res, 403, { error: 'Debe crear su propia contraseña antes de continuar', must_change: true });
        for (const r of routes) {
          if (r.method !== method) continue;
          const m = url.pathname.match(r.re);
          if (!m) continue;
          if (r.admin && session.role !== 'admin') return send(res, 403, { error: 'Solo el administrador puede realizar esta acción' });
          return send(res, 200, (await r.fn({ db, session, token: cookieOf(req, 'mc_session')!, clinic, params: m.slice(1), query: url.searchParams, body })) ?? { ok: true });
        }
        return send(res, 404, { error: 'No encontrado' });
      }

      // archivos estáticos
      let rel = pnormalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      if (!rel || rel.endsWith('/')) rel += 'index.html';
      const file = join(PUBLIC, rel);
      if (!file.startsWith(PUBLIC) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'No encontrado', { 'Content-Type': 'text/plain; charset=utf-8' });
      return send(res, 200, readFileSync(file), { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      console.error(e);
      return send(res, 500, { error: 'Error interno' });
    }
  };
}

// Webhook de WhatsApp Business Platform: solo responde si WHATSAPP_ENABLED=true (ver docs/WHATSAPP.md).
async function webhook(db: DB, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (!whatsappEnabled()) return send(res, 503, { error: 'Canal de WhatsApp no habilitado' });
  if (req.method === 'GET') {
    const ok = verifyChallenge(url.searchParams.get('hub.mode'), url.searchParams.get('hub.verify_token'), process.env.WHATSAPP_VERIFY_TOKEN);
    return send(res, ok ? 200 : 403, ok ? (url.searchParams.get('hub.challenge') ?? '') : 'Forbidden', { 'Content-Type': 'text/plain' });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido' });
  const raw = await readBody(req);
  if (!verifySignature(raw, req.headers['x-hub-signature-256'] as string | undefined, process.env.WHATSAPP_APP_SECRET ?? '')) return send(res, 401, { error: 'Firma inválida' });
  let body: unknown;
  try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'JSON inválido' }); }
  send(res, 200, { ok: true });   // Meta exige respuesta rápida; el procesamiento sigue después
  processWebhook(db, parseWebhook(body)).catch((e) => console.error('[whatsapp]', e.message));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {   // se ejecuta directamente (también en Windows)
  const dbArg = process.argv.find((a) => a.startsWith('--db='))?.slice(5) || process.env.MEDICONNECT_DB;
  const path = dbArg ?? fileURLToPath(new URL('../data/mediconnect.db', import.meta.url));
  mkdirSync(dirname(path), { recursive: true });
  if (whatsappEnabled() && whatsappConfigProblems().length) { console.error(`WHATSAPP_ENABLED=true pero faltan variables: ${whatsappConfigProblems().join(', ')}. Revise config/whatsapp.env.example.`); process.exit(1); }
  const db = openDb(path);
  if (!dbArg) seedDemo(db);   // la demo solo se siembra en la base por defecto; una base propia se crea con su script de configuración
  const port = Number(process.env.PORT ?? 3000), host = process.env.HOST ?? '127.0.0.1';
  createServer(createApp(db)).listen(port, host, () => {
    console.log(`MediConnect AI en http://${host}:${port}${one(db, `SELECT 1 FROM users WHERE email LIKE '%.demo'`) ? '  (demo: admin@santalucia.demo / Demo1234!)' : ''}`);
  });
  const syncSoon = (() => { let t: ReturnType<typeof setTimeout> | null = null; return () => { if (t) return; t = setTimeout(() => { t = null; syncOutbox(db).catch((e) => console.error(e.message)); }, 800); t.unref(); }; })();
  setCalendarWake(syncSoon);
  setInterval(() => { try { runAllReminders(db); } catch (e) { console.error(e); } syncOutbox(db).catch((e) => console.error(e.message)); }, 60000).unref();
}
