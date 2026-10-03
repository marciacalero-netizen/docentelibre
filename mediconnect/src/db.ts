import { DatabaseSync } from 'node:sqlite';

export type DB = DatabaseSync;

// Aislamiento multiempresa a nivel de base de datos: toda tabla de negocio lleva clinic_id y las
// llaves foráneas son COMPUESTAS (clinic_id, id), de modo que una fila de la clínica A jamás puede
// referenciar un médico, paciente o conversación de la clínica B.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS clinics (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'America/Guayaquil',
  address TEXT, city TEXT, maps_url TEXT,
  whatsapp_phone_id TEXT UNIQUE,         -- phone_number_id de WhatsApp Business Platform (futuro)
  settings TEXT NOT NULL DEFAULT '{}',   -- JSON: horarios, guardia, recordatorios, etc.
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','receptionist')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS specialties (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  active INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'appointment' CHECK (kind IN ('appointment','handoff','walkin')),
    -- appointment: el agente agenda | handoff: se deriva a una persona del área | walkin: sin cita (el agente informa)
  emoji TEXT,
  keywords TEXT,                          -- palabras que identifican el servicio en texto libre (separadas por coma)
  info TEXT,                              -- mensaje propio para servicios handoff/walkin
  contact_whatsapp TEXT,                  -- WhatsApp propio del área: si existe, el agente deriva al paciente a ese número
  UNIQUE (clinic_id, id), UNIQUE (clinic_id, name)
);
CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  specialty_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL,                             -- si es NULL se usa el precio de la especialidad
  slot_minutes INTEGER NOT NULL DEFAULT 30,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, specialty_id) REFERENCES specialties (clinic_id, id)
);
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  doctor_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  FOREIGN KEY (clinic_id, doctor_id) REFERENCES doctors (clinic_id, id)
);
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  phone TEXT NOT NULL,
  name TEXT,
  consent_at TEXT,                        -- consentimiento de tratamiento de datos (LOPDP)
  consent_version TEXT,
  is_holder INTEGER NOT NULL DEFAULT 1,   -- 1 = titular de la línea de WhatsApp; 0 = familiar a su cargo
  anonymized INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (clinic_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_holder ON patients (clinic_id, phone) WHERE is_holder = 1;
CREATE INDEX IF NOT EXISTS idx_patient_phone ON patients (clinic_id, phone);
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  doctor_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  start_at TEXT NOT NULL,                 -- hora local de la clínica
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  confirmed INTEGER NOT NULL DEFAULT 0,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  price REAL,
  created_at TEXT NOT NULL,
  cancelled_at TEXT,
  UNIQUE (clinic_id, id),
  FOREIGN KEY (clinic_id, doctor_id) REFERENCES doctors (clinic_id, id),
  FOREIGN KEY (clinic_id, patient_id) REFERENCES patients (clinic_id, id)
);
CREATE INDEX IF NOT EXISTS idx_appt_clinic_start ON appointments (clinic_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appt_doctor_start ON appointments (clinic_id, doctor_id, start_at);
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  patient_phone TEXT NOT NULL,
  patient_id INTEGER,
  status TEXT NOT NULL DEFAULT 'bot' CHECK (status IN ('bot','human')),
  flag TEXT,                              -- 'emergency' cuando se detectó una urgencia
  handoff_reason TEXT,
  handoff_area TEXT,                      -- área a la que se derivó (p. ej. Odontología)
  had_handoff INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT '{}',
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (clinic_id, patient_phone), UNIQUE (clinic_id, id)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  conversation_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  sender TEXT NOT NULL CHECK (sender IN ('patient','bot','staff')),
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TEXT NOT NULL,
  FOREIGN KEY (clinic_id, conversation_id) REFERENCES conversations (clinic_id, id)
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages (clinic_id, conversation_id, id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  type TEXT NOT NULL,                     -- emergency | handoff | oncall | cancellation
  level TEXT NOT NULL DEFAULT 'info',     -- info | urgent
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target TEXT,                            -- WhatsApp del personal de guardia (envío real: fase 2)
  conversation_id INTEGER,
  read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  created_at TEXT NOT NULL
);
`;

export function openDb(path: string): DB {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const cols = db.prepare(`PRAGMA table_info(patients)`).all() as { name: string }[];
  const spCols = db.prepare(`PRAGMA table_info(specialties)`).all() as { name: string }[];
  if ((cols.length && !cols.some((c) => c.name === 'is_holder')) || (spCols.length && !spCols.some((c) => c.name === 'kind'))) {
    throw new Error('La base de datos es de una versión anterior. Si es la demo, ejecuta «npm run seed» para regenerarla (borra los datos de demostración).');
  }
  if (spCols.length && !spCols.some((c) => c.name === 'contact_whatsapp')) db.exec('ALTER TABLE specialties ADD COLUMN contact_whatsapp TEXT');  // migración sin pérdida de datos
  db.exec(SCHEMA);
  return db;
}

export const all = <T = any>(db: DB, sql: string, ...p: any[]): T[] => db.prepare(sql).all(...p) as T[];
export const one = <T = any>(db: DB, sql: string, ...p: any[]): T | undefined => db.prepare(sql).get(...p) as T | undefined;
export const run = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).run(...p);

export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
