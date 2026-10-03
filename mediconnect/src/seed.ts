// Datos 100 % ficticios para la demo (nombres, teléfonos "+59399000xxxx" y direcciones inventados).
import type { DB } from './db.ts';
import { all, one, run, tx } from './db.ts';
import { hashPassword } from './auth.ts';
import { addDays, addMinutes, minutesBetween, nowIso, nowLocal, weekday } from './util.ts';
import { DEFAULT_SETTINGS, allClinics } from './services/clinic.ts';
import type { Settings } from './services/clinic.ts';
import { handleIncoming } from './agent/engine.ts';
import { getOrCreateConversation, logMessage } from './services/conversations.ts';

export const DEMO_PASSWORD = 'Demo1234!';

function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

const FIRST = ['María', 'José', 'Luis', 'Carmen', 'Jorge', 'Ana', 'Pedro', 'Rosa', 'Juan', 'Elena', 'Miguel', 'Patricia', 'Diego', 'Verónica', 'Fabián', 'Silvia', 'Kevin', 'Johanna', 'Andrés', 'Mónica'];
const LAST = ['Alvarado', 'Burgos', 'Castro', 'Delgado', 'Estrada', 'Franco', 'García', 'Holguín', 'Jaramillo', 'Loor', 'Macías', 'Naranjo', 'Ortiz', 'Pico', 'Quinde', 'Reyes', 'Suárez', 'Tigrero', 'Vélez', 'Yagual'];

type DocSeed = [name: string, specialty: string, price: number | null, slot: number, sched: [number[], string, string][]];
interface ClinicSeed {
  name: string; slug: string; address: string; city: string; maps: string; phoneId: string; settings: Partial<Settings>;
  specialties: [string, string, number | null, Partial<{ kind: string; emoji: string; keywords: string; info: string; contact: string }>?][]; doctors: DocSeed[]; users: [string, string, 'admin' | 'receptionist'][]; patients: number;
}
const WEEK = [1, 2, 3, 4, 5];

const CLINICS: ClinicSeed[] = [
  {
    name: 'Clínica Santa Lucía', slug: 'santa-lucia', address: 'Av. Víctor Emilio Estrada 123 y Ebanos, Urdesa', city: 'Guayaquil',
    maps: 'https://maps.example.com/clinica-santa-lucia', phoneId: 'DEMO-PHONE-ID-1',
    settings: { oncall_name: 'Dr. Luis Carranza (guardia)', oncall_whatsapp: '+593990009999' },
    specialties: [['Medicina General', 'Control y atención médica integral', 25], ['Pediatría', 'Niños y adolescentes', 35], ['Ginecología', 'Salud de la mujer', 40], ['Cardiología', 'Corazón y circulación', 50], ['Dermatología', 'Piel, cabello y uñas', 40],
      // Servicios con tratamiento especial (demo): atención directa con el área y sin cita
      ['Odontología', 'Limpieza, calzas y control', null, { kind: 'handoff', emoji: '🦷', keywords: 'dentista,dental,muela,diente,caries', contact: '+593990000444' }],
      ['Laboratorio Clínico', 'Exámenes de sangre y orina', null, { kind: 'walkin', emoji: '🧪', keywords: 'laboratorio,examen,examenes,analisis,orina', info: '🧪 *Laboratorio Clínico* (datos de demostración)\nAtención *sin cita*, de lunes a sábado, de 7:00 a. m. a 10:00 a. m.' }]],
    doctors: [
      ['Dra. Ana Morales', 'Medicina General', null, 20, [[WEEK, '08:00', '12:00'], [[1, 3, 5], '14:00', '17:00']]],
      ['Dr. Carlos Vera', 'Medicina General', null, 20, [[[1, 3, 5], '14:00', '18:00'], [[6], '08:00', '12:00']]],
      ['Dra. Lucía Paredes', 'Pediatría', null, 30, [[[1, 2, 3, 4], '09:00', '13:00']]],
      ['Dr. Andrés Salazar', 'Pediatría', 38, 30, [[[2, 4], '14:00', '18:00'], [[5], '08:00', '12:00']]],
      ['Dra. Gabriela Cedeño', 'Ginecología', null, 30, [[[1, 3, 5], '08:00', '13:00']]],
      ['Dr. Roberto Illescas', 'Cardiología', null, 30, [[[2, 4], '08:00', '12:00']]],
      ['Dra. Paola Mendoza', 'Dermatología', null, 30, [[[3], '14:00', '18:00'], [[6], '08:00', '12:00']]],
    ],
    users: [['Marcela Admin', 'admin@santalucia.demo', 'admin'], ['Rosa Recepción', 'recepcion@santalucia.demo', 'receptionist']],
    patients: 34,
  },
  {
    name: 'Consultorios MediSur', slug: 'medisur', address: 'Cdla. Kennedy Norte, Mz. 101 Villa 7', city: 'Guayaquil',
    maps: 'https://maps.example.com/consultorios-medisur', phoneId: 'DEMO-PHONE-ID-2',
    settings: { oncall_name: 'Dra. Sofía Intriago (guardia)', oncall_whatsapp: '+593990008888', hours: { '1': [['09:00', '17:00']], '2': [['09:00', '17:00']], '3': [['09:00', '17:00']], '4': [['09:00', '17:00']], '5': [['09:00', '17:00']], '6': [], '0': [] } },
    specialties: [['Medicina General', 'Atención médica de primer nivel', 22], ['Odontología', 'Limpieza, calzas y control', 30], ['Nutrición', 'Planes alimentarios', 28]],
    doctors: [
      ['Dr. Fernando Zambrano', 'Medicina General', null, 20, [[WEEK, '09:00', '13:00']]],
      ['Dra. Sofía Intriago', 'Medicina General', null, 20, [[WEEK, '14:00', '17:00']]],
      ['Dra. Karla Espinoza', 'Odontología', null, 30, [[[1, 3, 5], '09:00', '17:00']]],
      ['Lcda. Daniela Ponce', 'Nutrición', null, 30, [[[2, 4], '09:00', '15:00']]],
    ],
    users: [['Admin MediSur', 'admin@medisur.demo', 'admin']],
    patients: 16,
  },
];

export function seedDemo(db: DB): void {
  if (one(db, 'SELECT id FROM clinics LIMIT 1')) return;
  tx(db, () => { CLINICS.forEach((c, i) => seedClinic(db, c, i + 1)); });
  const clinics = allClinics(db);
  clinics.forEach((c, i) => seedConversations(db, c.id, i));
}

function seedClinic(db: DB, c: ClinicSeed, n: number): void {
  const rand = rng(1000 + n);
  const settings = { ...DEFAULT_SETTINGS, ...c.settings };
  const clinicId = Number(run(db, 'INSERT INTO clinics (name, slug, address, city, maps_url, whatsapp_phone_id, settings, created_at) VALUES (?,?,?,?,?,?,?,?)',
    c.name, c.slug, c.address, c.city, c.maps, c.phoneId, JSON.stringify(settings), nowIso()).lastInsertRowid);
  for (const [name, email, role] of c.users) run(db, 'INSERT INTO users (clinic_id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,?,?)', clinicId, name, email, hashPassword(DEMO_PASSWORD), role, nowIso());
  const spIds = new Map<string, number>();
  for (const [name, desc, price, x] of c.specialties) spIds.set(name, Number(run(db, 'INSERT INTO specialties (clinic_id, name, description, price, kind, emoji, keywords, info, contact_whatsapp) VALUES (?,?,?,?,?,?,?,?,?)', clinicId, name, desc, price, x?.kind ?? 'appointment', x?.emoji ?? null, x?.keywords ?? null, x?.info ?? null, x?.contact ?? null).lastInsertRowid));
  const docs: { id: number; slot: number; price: number | null; spPrice: number }[] = [];
  for (const [name, sp, price, slot, sched] of c.doctors) {
    const id = Number(run(db, 'INSERT INTO doctors (clinic_id, specialty_id, name, price, slot_minutes) VALUES (?,?,?,?,?)', clinicId, spIds.get(sp), name, price, slot).lastInsertRowid);
    for (const [days, a, b] of sched) for (const d of days) run(db, 'INSERT INTO schedules (clinic_id, doctor_id, weekday, start_time, end_time) VALUES (?,?,?,?,?)', clinicId, id, d, a, b);
    docs.push({ id, slot, price, spPrice: c.specialties.find((s) => s[0] === sp)![2] ?? 0 });
  }
  const patientIds: number[] = [];
  for (let i = 0; i < c.patients; i++) {
    const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
    const phone = `+59399${n}${String(i + 1).padStart(5, '0')}`.slice(0, 13);
    const created = new Date(Date.now() - Math.floor(rand() * 60) * 86400000).toISOString();
    patientIds.push(Number(run(db, 'INSERT INTO patients (clinic_id, phone, name, consent_at, consent_version, created_at) VALUES (?,?,?,?,?,?)', clinicId, phone, name, created, 'LOPDP-v1', created).lastInsertRowid));
  }
  // Familiares: algunos titulares tienen hijos/as registrados bajo su mismo número de WhatsApp.
  ['Mateo', 'Valentina', 'Emilia', 'Thiago', 'Camila'].forEach((kid, i) => {
    const h = one<any>(db, 'SELECT phone, name, consent_at FROM patients WHERE clinic_id = ? AND id = ?', clinicId, patientIds[i])!;
    const surnames = (h.name as string).split(' ').slice(1).join(' ');
    patientIds.push(Number(run(db, 'INSERT INTO patients (clinic_id, phone, name, is_holder, consent_at, consent_version, created_at) VALUES (?,?,?,0,?,?,?)', clinicId, h.phone, `${kid} ${surnames}`, h.consent_at, 'LOPDP-v1-representante', h.consent_at).lastInsertRowid));
  });
  // Historial y agenda: ~40 % de los horarios de los últimos 30 días y de los próximos 14.
  const clinic = { tz: 'America/Guayaquil' };
  const now = nowLocal(clinic.tz);
  const today = now.slice(0, 10);
  const usedPatientSlots = new Set<string>();
  for (const d of docs) {
    const scheds = all<any>(db, 'SELECT weekday, start_time, end_time FROM schedules WHERE clinic_id = ? AND doctor_id = ?', clinicId, d.id);
    for (let off = -30; off <= 14; off++) {
      const date = addDays(today, off);
      for (const s of scheds.filter((x) => x.weekday === weekday(date))) {
        for (let t = `${date}T${s.start_time}`; minutesBetween(t, `${date}T${s.end_time}`) >= d.slot; t = addMinutes(t, d.slot)) {
          if (rand() > 0.4) continue;
          const pid = patientIds[Math.floor(rand() * patientIds.length)];
          if (usedPatientSlots.has(`${pid}|${t}`)) continue;
          usedPatientSlots.add(`${pid}|${t}`);
          const past = t < now;
          const r = rand();
          const status = past ? (r < 0.78 ? 'completed' : r < 0.86 ? 'no_show' : 'cancelled') : (r < 0.08 ? 'cancelled' : 'scheduled');
          const soon = !past && minutesBetween(now, t) <= 24 * 60;
          run(db, `INSERT INTO appointments (clinic_id, doctor_id, patient_id, start_at, end_at, status, confirmed, reminder_sent, source, price, created_at, cancelled_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, clinicId, d.id, pid, t, addMinutes(t, d.slot), status,
            status === 'scheduled' && rand() < 0.4 ? 1 : 0, soon ? 1 : 0, rand() < 0.7 ? 'whatsapp' : 'panel', d.price ?? d.spPrice, new Date().toISOString(), status === 'cancelled' ? new Date().toISOString() : null);
        }
      }
    }
  }
  // Conversaciones históricas ligeras para las estadísticas (algunas derivadas a recepción).
  for (let i = 0; i < Math.min(c.patients, 24); i++) {
    const p = one<any>(db, 'SELECT phone FROM patients WHERE clinic_id = ? AND id = ?', clinicId, patientIds[i])!;
    const at = new Date(Date.now() - (1 + Math.floor(rand() * 28)) * 86400000).toISOString();
    const handed = rand() < 0.15;
    const convId = Number(run(db, 'INSERT INTO conversations (clinic_id, patient_phone, patient_id, status, had_handoff, handoff_reason, state, last_message_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      clinicId, p.phone, patientIds[i], 'bot', handed ? 1 : 0, handed ? 'Consulta administrativa' : null, '{}', at, at).lastInsertRowid);
    logMessage(db, clinicId, convId, { direction: 'in', sender: 'patient', body: 'Hola, quisiera una cita', at });
    logMessage(db, clinicId, convId, { direction: 'out', sender: 'bot', body: '¡Hola! 👋 Con gusto te ayudo a agendar tu cita.', at });
  }
}

function seedConversations(db: DB, clinicId: number, idx: number): void {
  const at = (minAgo: number, k: number) => new Date(Date.now() - minAgo * 60000 + k * 30000).toISOString();
  const script = (phone: string, minAgo: number, lines: string[]) => lines.forEach((l, k) => handleIncoming(db, clinicId, phone, l, { at: at(minAgo, k) }));
  const base = `+5939980${idx}`;
  // 1) Reserva completa + reagendamiento por WhatsApp
  script(`${base}001`, 180, ['Hola', '1', 'si', '1', 'maria fernanda zambrano', '1', '1', '1', 'si']);
  script(`${base}001`, 120, ['necesito reagendar mi cita', '2', 'si']);
  // 1b) La misma persona agenda para una familiar (otra persona bajo el mismo número)
  script(`${base}001`, 100, ['agendar', '2', 'sofia zambrano vera', '1', '1', '1', 'si']);
  // 2) Consulta informativa
  script(`${base}002`, 90, ['Buenas tardes', 'cuánto cuesta la consulta?', 'dónde están ubicados?']);
  // 3) Petición clínica -> el bot no diagnostica
  script(`${base}003`, 60, ['Me duele la cabeza hace días, qué tengo?']);
  // 4) Emergencia -> alerta urgente
  script(`${base}004`, 45, ['Mi papá tiene dolor fuerte en el pecho y no puede respirar']);
  // 5) Derivación a recepcionista (queda esperando)
  script(`${base}005`, 20, ['Quiero hablar con una persona, tengo un problema con mi factura']);
  // 6) Derivación atendida por el personal
  script(`${base}006`, 75, ['recepcionista por favor']);
  const c6 = getOrCreateConversation(db, clinicId, `${base}006`, nowIso());
  logMessage(db, clinicId, c6.id, { direction: 'out', sender: 'staff', body: 'Hola, soy Rosa de recepción. ¿En qué te puedo ayudar?', at: at(70, 0) });
  run(db, `UPDATE conversations SET status = 'bot' WHERE clinic_id = ? AND id = ?`, clinicId, c6.id);
}
