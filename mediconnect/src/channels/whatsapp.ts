// Adaptador de WhatsApp Business Platform (Cloud API de Meta).
// Deshabilitado por defecto: solo se activa con WHATSAPP_ENABLED=true. Las credenciales salen SIEMPRE
// de variables de entorno (nunca de la base de datos ni del repositorio). Ver config/whatsapp.env.example.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface InboundMessage { phoneNumberId: string; from: string; text: string; messageId: string; kind: 'text' | 'unsupported'; unsupportedType?: string }
/** Mensaje enviado por una persona del centro desde la app WhatsApp Business (modo coexistencia). */
export interface EchoMessage { phoneNumberId: string; to: string; text: string; messageId: string }
export interface ParsedWebhook { inbound: InboundMessage[]; echoes: EchoMessage[]; statusErrors: string[] }

export const whatsappEnabled = (): boolean => process.env.WHATSAPP_ENABLED === 'true';

/** Variables que faltan para operar. Lista vacía = configuración completa. */
export function whatsappConfigProblems(env: NodeJS.ProcessEnv = process.env): string[] {
  return ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_TOKEN'].filter((k) => !env[k]);
}

const safeEqual = (a: string, b: string): boolean => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Verificación inicial del webhook (GET): Meta envía hub.mode, hub.verify_token y hub.challenge. */
export function verifyChallenge(mode: string | null, token: string | null, expected: string | undefined): boolean {
  return mode === 'subscribe' && !!expected && !!token && safeEqual(token, expected);
}

/** Valida la firma X-Hub-Signature-256 que Meta añade a cada webhook. */
export function verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
  if (!header?.startsWith('sha256=') || !appSecret) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(header.slice(7), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const plusPhone = (v: unknown): string => `+${String(v ?? '').replace(/\D/g, '')}`;

/**
 * Extrae del payload oficial de Meta:
 *  - mensajes entrantes de texto (y respuestas a botones/listas, que se tratan como texto);
 *  - mensajes de otro tipo (audio, imagen, ubicación…), para responder que solo se lee texto;
 *  - ecos de mensajes que el personal escribió desde la app (campo smb_message_echoes);
 *  - errores de entrega (statuses con errors), solo para el registro del servidor.
 */
export function parseWebhook(body: any): ParsedWebhook {
  const out: ParsedWebhook = { inbound: [], echoes: [], statusErrors: [] };
  for (const entry of body?.entry ?? []) for (const change of entry?.changes ?? []) {
    const v = change?.value;
    const phoneNumberId = String(v?.metadata?.phone_number_id ?? '');
    for (const m of v?.messages ?? []) {
      if (!m?.id || !m?.from) continue;
      const base = { phoneNumberId, from: plusPhone(m.from), messageId: String(m.id) };
      const text = m.type === 'text' ? m.text?.body
        : m.type === 'interactive' ? (m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title)
        : m.type === 'button' ? m.button?.text : undefined;
      if (text) out.inbound.push({ ...base, text: String(text), kind: 'text' });
      else if (m.type !== 'reaction' && m.type !== 'unsupported' && m.type !== 'system') out.inbound.push({ ...base, text: '', kind: 'unsupported', unsupportedType: String(m.type ?? 'desconocido') });
    }
    for (const e of v?.message_echoes ?? []) {
      if (e?.id && e?.to && e.type === 'text' && e.text?.body) out.echoes.push({ phoneNumberId, to: plusPhone(e.to), text: String(e.text.body), messageId: String(e.id) });
    }
    for (const s of v?.statuses ?? []) if (s?.status === 'failed') out.statusErrors.push(`Entrega fallida (${s.errors?.[0]?.code ?? '?'}): ${s.errors?.[0]?.title ?? 'sin detalle'}`);
  }
  return out;
}

// ───────── envío saliente ─────────

export interface HttpResult { status: number; body: any }
export type Transport = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<HttpResult>;

const realTransport: Transport = async (url, init) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
let transport: Transport = realTransport;
/** Solo para pruebas: reemplaza el envío HTTP para no tocar internet. */
export const setTransport = (t: Transport | null): void => { transport = t ?? realTransport; };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let retryDelayMs = 700;
export const setRetryDelay = (ms: number): void => { retryDelayMs = ms; };

/** Envía un texto. Reintenta ante errores temporales (429/5xx); los demás errores se informan sin reintentar. */
export async function sendText(phoneNumberId: string, to: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN no está configurado');
  if (!/^\d{5,20}$/.test(phoneNumberId)) throw new Error('phone_number_id inválido');
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v21.0'}/${phoneNumberId}/messages`;
  const init = {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/\D/g, ''), type: 'text', text: { preview_url: true, body: text.slice(0, 4000) } }),
  };
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await transport(url, init);
      if (r.status >= 200 && r.status < 300) return;
      last = `WhatsApp respondió ${r.status}: ${r.body?.error?.message ?? 'sin detalle'}${r.body?.error?.code ? ` (código ${r.body.error.code})` : ''}`;
      if (r.status !== 429 && r.status < 500) break;
    } catch (e: any) { last = `No se pudo contactar a WhatsApp: ${e?.message ?? e}`; }
    if (attempt < 2) await sleep(retryDelayMs * (attempt + 1));
  }
  throw new Error(last);   // nunca incluye el token
}
