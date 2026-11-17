import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { normalize, nowIso } from '../util.ts';

// Un número de WhatsApp = un titular + hasta MAX_DEPENDENTS familiares a su cargo.
export const MAX_DEPENDENTS = 6;
export const CONSENT_REPRESENTATIVE = 'LOPDP-v1-representante';

export interface Patient { id: number; clinic_id: number; phone: string; name: string | null; is_holder: number; consent_at: string | null; consent_version: string | null; anonymized: number }

export const holderByPhone = (db: DB, clinicId: number, phone: string): Patient | undefined =>
  one<Patient>(db, 'SELECT * FROM patients WHERE clinic_id = ? AND phone = ? AND is_holder = 1', clinicId, phone);

/** Titular primero y luego los familiares, sin los anonimizados. */
export const membersByPhone = (db: DB, clinicId: number, phone: string): Patient[] =>
  all<Patient>(db, 'SELECT * FROM patients WHERE clinic_id = ? AND phone = ? AND anonymized = 0 ORDER BY is_holder DESC, id', clinicId, phone);

export function addDependent(db: DB, clinicId: number, holder: Patient, name: string): { ok: true; id: number; existing: boolean } | { ok: false; error: string } {
  const members = membersByPhone(db, clinicId, holder.phone);
  const same = members.find((m) => m.name && normalize(m.name) === normalize(name));
  if (same) return { ok: true, id: same.id, existing: true };
  if (members.filter((m) => !m.is_holder).length >= MAX_DEPENDENTS) return { ok: false, error: `Solo se pueden registrar hasta ${MAX_DEPENDENTS} familiares por número` };
  // El consentimiento lo da el titular, que declara ser representante o tener autorización.
  const r = run(db, 'INSERT INTO patients (clinic_id, phone, name, is_holder, consent_at, consent_version, created_at) VALUES (?,?,?,0,?,?,?)',
    clinicId, holder.phone, name, holder.consent_at ? nowIso() : null, holder.consent_at ? CONSENT_REPRESENTATIVE : null, nowIso());
  return { ok: true, id: Number(r.lastInsertRowid), existing: false };
}

/** Uso del panel: localiza a la persona por teléfono + nombre; si el teléfono ya existe con otra persona, la crea como familiar. */
export function findOrCreateByPhoneAndName(db: DB, clinicId: number, phone: string, name: string): number {
  const holder = holderByPhone(db, clinicId, phone);
  if (!holder) return Number(run(db, 'INSERT INTO patients (clinic_id, phone, name, created_at) VALUES (?,?,?,?)', clinicId, phone, name, nowIso()).lastInsertRowid);
  if (!holder.name) { run(db, 'UPDATE patients SET name = ? WHERE clinic_id = ? AND id = ?', name, clinicId, holder.id); return holder.id; }
  const r = addDependent(db, clinicId, holder, name);
  if (!r.ok) throw new Error(r.error);
  return r.id;
}
