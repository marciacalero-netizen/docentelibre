// Mensajes que inicia el centro (recordatorios, encuestas). WhatsApp solo permite texto libre dentro de las
// 24 h desde el último mensaje del paciente; fuera de esa ventana se usa una plantilla aprobada por Meta.
import type { DB } from '../db.ts';
import { one } from '../db.ts';
import { sendTemplate, sendText, whatsappEnabled } from '../channels/whatsapp.ts';
import type { Clinic } from './clinic.ts';
import { notify } from './notify.ts';

/** Margen de seguridad: se considera abierta la ventana solo si el último mensaje del paciente tiene menos de 23 h 30 min. */
const WINDOW_MS = 23.5 * 3600000;

export type Outcome = 'sent' | 'template' | 'no_template' | 'failed' | 'logged';

export function windowOpen(db: DB, clinicId: number, conversationId: number, now = Date.now()): boolean {
  const t = one<{ t: string | null }>(db, `SELECT MAX(created_at) AS t FROM messages WHERE clinic_id = ? AND conversation_id = ? AND direction = 'in'`, clinicId, conversationId)?.t;
  return !!t && now - Date.parse(t) < WINDOW_MS;
}

/**
 * Entrega un mensaje ya registrado en la conversación. Sin WhatsApp real (demo, simulador) solo queda registrado.
 * Con `alert`, si no se pudo entregar se crea una alerta para que recepción contacte al paciente por otra vía.
 */
export async function deliverProactive(db: DB, clinic: Clinic, o: {
  conversationId: number; phone: string; text: string; template: 'reminder' | 'survey'; params: string[]; what: string; alert: boolean;
}): Promise<Outcome> {
  if (!whatsappEnabled() || !clinic.whatsapp_phone_id) return 'logged';
  const name = clinic.settings.wa_templates[o.template];
  let outcome: Outcome;
  let error = '';
  try {
    if (windowOpen(db, clinic.id, o.conversationId)) { await sendText(clinic.whatsapp_phone_id, o.phone, o.text); outcome = 'sent'; }
    else if (name) { await sendTemplate(clinic.whatsapp_phone_id, o.phone, name, clinic.settings.wa_templates.language, o.params); outcome = 'template'; }
    else outcome = 'no_template';
  } catch (e: any) { outcome = 'failed'; error = String(e.message).slice(0, 160); console.error(`[whatsapp] ${error}`); }
  if (o.alert && (outcome === 'no_template' || outcome === 'failed')) {
    notify(db, clinic.id, {
      type: 'send_failed', conversationId: o.conversationId, title: `${o.what} no enviado por WhatsApp`,
      body: outcome === 'no_template'
        ? `El paciente no escribió en las últimas 24 h y falta la plantilla aprobada por Meta (Configuración → Mensajes automáticos). Si es importante, contáctelo por otra vía.`
        : `WhatsApp no aceptó el mensaje (${error}). Revise la plantilla en Configuración → Mensajes automáticos.`,
    });
  }
  return outcome;
}
