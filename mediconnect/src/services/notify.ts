import type { DB } from '../db.ts';
import { run } from '../db.ts';
import { nowIso } from '../util.ts';

/** Registra una alerta para el personal. El envío real al WhatsApp de guardia es parte de la fase 2. */
export function notify(db: DB, clinicId: number, n: { type: string; level?: 'info' | 'urgent'; title: string; body: string; target?: string; conversationId?: number }): void {
  run(db, 'INSERT INTO notifications (clinic_id, type, level, title, body, target, conversation_id, created_at) VALUES (?,?,?,?,?,?,?,?)',
    clinicId, n.type, n.level ?? 'info', n.title, n.body, n.target ?? null, n.conversationId ?? null, nowIso());
}
