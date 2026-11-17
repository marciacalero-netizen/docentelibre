import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { nowIso } from '../util.ts';

export interface Conversation { id: number; clinic_id: number; patient_phone: string; patient_id: number | null; status: 'bot' | 'human'; flag: string | null; handoff_reason: string | null; had_handoff: number; state: string; last_message_at: string }

export function getOrCreateConversation(db: DB, clinicId: number, phone: string, at: string): Conversation {
  const existing = one<Conversation>(db, 'SELECT * FROM conversations WHERE clinic_id = ? AND patient_phone = ?', clinicId, phone);
  if (existing) return existing;
  const patient = one<{ id: number }>(db, 'SELECT id FROM patients WHERE clinic_id = ? AND phone = ? AND is_holder = 1', clinicId, phone);
  const r = run(db, 'INSERT INTO conversations (clinic_id, patient_phone, patient_id, last_message_at, created_at) VALUES (?,?,?,?,?)', clinicId, phone, patient?.id ?? null, at, at);
  return one<Conversation>(db, 'SELECT * FROM conversations WHERE clinic_id = ? AND id = ?', clinicId, Number(r.lastInsertRowid))!;
}

export function logMessage(db: DB, clinicId: number, conversationId: number, m: { direction: 'in' | 'out'; sender: 'patient' | 'bot' | 'staff'; body: string; kind?: string; at?: string }): number {
  const at = m.at ?? nowIso();
  const r = run(db, 'INSERT INTO messages (clinic_id, conversation_id, direction, sender, body, kind, created_at) VALUES (?,?,?,?,?,?,?)',
    clinicId, conversationId, m.direction, m.sender, m.body, m.kind ?? 'text', at);
  run(db, 'UPDATE conversations SET last_message_at = ? WHERE clinic_id = ? AND id = ?', at, clinicId, conversationId);
  return Number(r.lastInsertRowid);
}

export const getMessages = (db: DB, clinicId: number, conversationId: number, afterId = 0) =>
  all(db, `SELECT g.id, g.direction, g.sender, g.body, g.kind, g.created_at, m.id AS media_id, m.mime AS media_mime, m.filename AS media_name, (m.deleted_at IS NOT NULL) AS media_deleted
    FROM messages g LEFT JOIN media m ON m.clinic_id = g.clinic_id AND m.message_id = g.id
    WHERE g.clinic_id = ? AND g.conversation_id = ? AND g.id > ? ORDER BY g.id`, clinicId, conversationId, afterId);
