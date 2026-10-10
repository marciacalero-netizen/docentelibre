// Procesa los eventos que Meta entrega al webhook: mensajes de pacientes y mensajes que el personal
// escribe desde la app WhatsApp Business (coexistencia). Sin servidor web: se prueba con payloads simulados.
import type { DB } from '../db.ts';
import { one, run } from '../db.ts';
import { handleIncoming } from '../agent/engine.ts';
import { sendText, type ParsedWebhook } from '../channels/whatsapp.ts';
import { getClinicByPhoneId } from './clinic.ts';
import { getOrCreateConversation, logMessage } from './conversations.ts';
import { notify } from './notify.ts';
import { nowIso } from '../util.ts';

/** Motivo con el que el bot se pausa cuando responde una persona desde la app. Solo estas pausas se levantan solas. */
export const STAFF_PAUSE_REASON = 'Atendida por el personal desde el celular';
const WEEK_MS = 7 * 86400000;

/** true si el mensaje es nuevo; false si Meta lo reenvió y ya se procesó. */
function firstTime(db: DB, id: string, at: string): boolean {
  run(db, 'DELETE FROM wa_processed WHERE created_at < ?', nowIso(new Date(Date.parse(at) - WEEK_MS)));
  return run(db, 'INSERT OR IGNORE INTO wa_processed (message_id, created_at) VALUES (?,?)', id, at).changes === 1;
}

async function deliver(db: DB, clinicId: number, conversationId: number, phoneId: string, to: string, replies: string[]): Promise<void> {
  for (const text of replies) {
    try { await sendText(phoneId, to, text); }
    catch (e: any) {
      console.error(`[whatsapp] ${e.message}`);
      notify(db, clinicId, { type: 'send_failed', level: 'urgent', conversationId, title: '⚠️ No se pudo enviar una respuesta por WhatsApp', body: `Un mensaje al paciente no salió (${String(e.message).slice(0, 160)}). Revise la conversación y escríbale desde el celular del centro si hace falta.` });
      return;   // si una falla, las siguientes tampoco se envían para no desordenar la conversación
    }
  }
}

/** El bot vuelve a atender si la pausa fue por una respuesta del personal desde el celular y ya pasó el tiempo configurado. */
function releaseExpiredPause(db: DB, clinicId: number, pauseHours: number, convId: number, at: string): void {
  const c = one<{ status: string; handoff_reason: string | null }>(db, 'SELECT status, handoff_reason FROM conversations WHERE clinic_id = ? AND id = ?', clinicId, convId);
  if (!c || c.status !== 'human' || c.handoff_reason !== STAFF_PAUSE_REASON) return;
  const last = one<{ t: string | null }>(db, `SELECT MAX(created_at) AS t FROM messages WHERE clinic_id = ? AND conversation_id = ? AND sender = 'staff'`, clinicId, convId)?.t;
  if (!last || Date.parse(at) - Date.parse(last) < pauseHours * 3600000) return;
  run(db, `UPDATE conversations SET status = 'bot', handoff_reason = NULL, handoff_area = NULL, state = '{}' WHERE clinic_id = ? AND id = ?`, clinicId, convId);
}

const UNSUPPORTED_REPLY = 'Por ahora solo puedo leer mensajes de *texto* 🙂 ¿Me lo puede escribir? Si es una emergencia, llame al *911* (ECU 911).';

let chain: Promise<void> = Promise.resolve();
/** Procesa un webhook ya validado. Los lotes se atienden de uno en uno para no desordenar las respuestas. */
export function processWebhook(db: DB, parsed: ParsedWebhook, opts: { at?: string } = {}): Promise<void> {
  const next = chain.then(() => run_(db, parsed, opts.at));
  chain = next.catch(() => undefined);
  return next;
}

async function run_(db: DB, parsed: ParsedWebhook, atOpt?: string): Promise<void> {
  for (const msg of parsed.statusErrors) console.error(`[whatsapp] ${msg}`);

  for (const e of parsed.echoes) {
    const clinic = getClinicByPhoneId(db, e.phoneNumberId);
    const at = atOpt ?? nowIso();
    if (!clinic || !firstTime(db, e.messageId, at)) continue;
    const conv = getOrCreateConversation(db, clinic.id, e.to, at);
    // Defensa: si Meta devolviera como eco un mensaje que envió el propio bot, no es una persona y no debe pausarlo.
    const own = one(db, `SELECT 1 FROM messages WHERE clinic_id = ? AND conversation_id = ? AND sender = 'bot' AND body = ? AND created_at >= ?`, clinic.id, conv.id, e.text, nowIso(new Date(Date.parse(at) - 10 * 60000)));
    if (own) continue;
    logMessage(db, clinic.id, conv.id, { direction: 'out', sender: 'staff', body: e.text, at });
    if (conv.status !== 'human') {
      run(db, `UPDATE conversations SET status = 'human', had_handoff = 1, handoff_reason = ?, state = '{}' WHERE clinic_id = ? AND id = ?`, STAFF_PAUSE_REASON, clinic.id, conv.id);
    }
  }

  for (const m of parsed.inbound) {
    const clinic = getClinicByPhoneId(db, m.phoneNumberId);   // el número de WhatsApp determina la clínica
    const at = atOpt ?? nowIso();
    if (!clinic || !firstTime(db, m.messageId, at)) continue;
    const existing = one<{ id: number }>(db, 'SELECT id FROM conversations WHERE clinic_id = ? AND patient_phone = ?', clinic.id, m.from);
    if (existing) releaseExpiredPause(db, clinic.id, clinic.settings.staff_pause_hours, existing.id, at);

    if (m.kind === 'unsupported') {
      const conv = getOrCreateConversation(db, clinic.id, m.from, at);
      logMessage(db, clinic.id, conv.id, { direction: 'in', sender: 'patient', body: `[${m.unsupportedType}]`, kind: m.unsupportedType, at });
      if (conv.status === 'human') continue;   // una persona atiende: no se interviene
      logMessage(db, clinic.id, conv.id, { direction: 'out', sender: 'bot', body: UNSUPPORTED_REPLY, at });
      await deliver(db, clinic.id, conv.id, m.phoneNumberId, m.from, [UNSUPPORTED_REPLY]);
      continue;
    }
    const r = handleIncoming(db, clinic.id, m.from, m.text, { at });
    await deliver(db, clinic.id, r.conversationId, m.phoneNumberId, m.from, r.replies);
  }
}
