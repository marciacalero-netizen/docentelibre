// Avisos «push» al celular o la computadora del personal (Web Push con VAPID), sin dependencias externas.
// El aviso viaja SIN contenido: el servicio de notificaciones del navegador (Google, Mozilla, Apple, Microsoft)
// solo sabe que hay que despertar al panel. El texto lo arma el propio panel (public/sw.js) y nunca lleva
// nombres ni datos del paciente, para que no se vean en la pantalla bloqueada.
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { nowIso } from '../util.ts';

const b64u = (b: Buffer | string): string => Buffer.from(b).toString('base64url');

/** Claves VAPID del servidor: se crean una sola vez y quedan en la base. */
function vapid(db: DB): { publicKey: string; jwk: { kty: string; crv: string; x: string; y: string; d: string } } {
  let row = one<{ v: string }>(db, `SELECT v FROM app_kv WHERE k = 'vapid'`);
  if (!row) {
    const jwk = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' });
    run(db, `INSERT OR IGNORE INTO app_kv (k, v) VALUES ('vapid', ?)`, JSON.stringify(jwk));
    row = one<{ v: string }>(db, `SELECT v FROM app_kv WHERE k = 'vapid'`)!;
  }
  const jwk = JSON.parse(row.v);
  return { jwk, publicKey: b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])) };
}
export const vapidPublicKey = (db: DB): string => vapid(db).publicKey;

/** Firma VAPID (JWT ES256) para el servicio de notificaciones del endpoint. */
export function vapidAuth(db: DB, endpoint: string, now = Date.now()): string {
  const { jwk, publicKey } = vapid(db);
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || 'https://mediconnectec.com' }));
  const sig = sign('sha256', Buffer.from(`${head}.${claims}`), { key: createPrivateKey({ key: jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${publicKey}`;
}

// Solo se aceptan endpoints de los servicios de notificaciones de los navegadores (evita que el servidor llame a cualquier URL).
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
export function validEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

export function saveSubscription(db: DB, clinicId: number, userId: number, endpoint: string): void {
  run(db, `INSERT INTO push_subs (clinic_id, user_id, endpoint, created_at) VALUES (?,?,?,?)
    ON CONFLICT(endpoint) DO UPDATE SET clinic_id = excluded.clinic_id, user_id = excluded.user_id`, clinicId, userId, endpoint, nowIso());
}
export const removeSubscription = (db: DB, clinicId: number, endpoint: string): void => { run(db, 'DELETE FROM push_subs WHERE clinic_id = ? AND endpoint = ?', clinicId, endpoint); };
export const removeUserSubscriptions = (db: DB, clinicId: number, userId: number): void => { run(db, 'DELETE FROM push_subs WHERE clinic_id = ? AND user_id = ?', clinicId, userId); };

/** Envía el aviso a cada dispositivo. Los que el navegador dio de baja (404/410) se borran. */
export async function sendPush(db: DB, subs: { id: number; endpoint: string }[]): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const r = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: vapidAuth(db, s.endpoint), TTL: '600', Urgency: 'high', 'Content-Length': '0' }, signal: AbortSignal.timeout(10000) });
      if (r.ok) { sent++; return; }
      failed++;
      if (r.status === 404 || r.status === 410) run(db, 'DELETE FROM push_subs WHERE id = ?', s.id);
      else console.error(`[push] el servicio respondió ${r.status}`);
    } catch (e: any) { failed++; console.error(`[push] ${e.cause?.code ?? e.message}`); }
  }));
  return { sent, failed };
}

const activeSubs = (db: DB, clinicId: number, userId?: number) => all<{ id: number; endpoint: string }>(db,
  `SELECT s.id, s.endpoint FROM push_subs s JOIN users u ON u.id = s.user_id AND u.clinic_id = s.clinic_id AND u.active = 1 WHERE s.clinic_id = ? ${userId ? 'AND s.user_id = ?' : ''}`, ...(userId ? [clinicId, userId] : [clinicId]));
export const testPush = (db: DB, clinicId: number, userId: number) => sendPush(db, activeSubs(db, clinicId, userId));

// Varios mensajes seguidos producen un solo aviso cada GAP ms (el aviso dice cuántos chats esperan, no cada mensaje).
let GAP = 15000;
export const setAlertGap = (ms: number): void => { GAP = ms; };   // para las pruebas
const last = new Map<number, number>(), pending = new Set<number>();
/** Avisa a todo el personal de la clínica que un chat espera respuesta. No bloquea: el envío sigue en segundo plano. */
export function alertStaff(db: DB, clinicId: number): void {
  if (pending.has(clinicId)) return;
  if (!one(db, 'SELECT 1 FROM push_subs WHERE clinic_id = ? LIMIT 1', clinicId)) return;
  const wait = Math.max(0, (last.get(clinicId) ?? 0) + GAP - Date.now());
  pending.add(clinicId);
  setTimeout(() => {
    pending.delete(clinicId); last.set(clinicId, Date.now());
    sendPush(db, activeSubs(db, clinicId)).catch((e) => console.error('[push]', e.message));
  }, wait).unref();
}
