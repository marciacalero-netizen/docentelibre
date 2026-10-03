// Adaptador de WhatsApp Business Platform (Cloud API de Meta) — FASE 2.
// En esta versión el webhook está DESHABILITADO por defecto y el envío no está implementado:
// no se contrata ni se conecta ningún servicio externo hasta que el cliente lo autorice.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InboundMessage { phoneNumberId: string; from: string; text: string; messageId: string }

export const whatsappEnabled = (): boolean => process.env.WHATSAPP_ENABLED === 'true';

/** Valida la firma X-Hub-Signature-256 que Meta añade a cada webhook. */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Extrae solo los mensajes de texto entrantes del payload oficial de Meta. */
export function parseWebhook(body: any): InboundMessage[] {
  const out: InboundMessage[] = [];
  for (const entry of body?.entry ?? []) for (const change of entry?.changes ?? []) {
    const v = change?.value;
    for (const m of v?.messages ?? []) {
      if (m?.type === 'text' && m.text?.body) out.push({ phoneNumberId: String(v.metadata?.phone_number_id ?? ''), from: `+${m.from}`, text: String(m.text.body), messageId: String(m.id) });
    }
  }
  return out;
}

/** Envío saliente. Pendiente de implementar con credenciales del cliente (token por clínica). */
export async function sendText(_phoneNumberId: string, _to: string, _text: string): Promise<void> {
  throw new Error('Envío por WhatsApp Business Platform no habilitado en esta versión (fase 2).');
}
