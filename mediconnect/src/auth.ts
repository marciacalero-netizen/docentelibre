import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DB } from './db.ts';
import { one } from './db.ts';

export const hashPassword = (pw: string): string => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
};
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const a = Buffer.from(hash, 'hex'), b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type Role = 'admin' | 'receptionist';
export interface Session { userId: number; clinicId: number; role: Role; name: string; expires: number }

const sessions = new Map<string, Session>();
const TTL = 8 * 3600 * 1000;
const attempts = new Map<string, { n: number; until: number }>();

export function login(db: DB, email: string, password: string, ip: string): { token: string; session: Session } | { error: string } {
  const key = `${ip}|${email.toLowerCase()}`;
  const a = attempts.get(key);
  if (a && a.n >= 5 && a.until > Date.now()) return { error: 'Demasiados intentos. Espera unos minutos.' };
  const u = one<any>(db, 'SELECT u.*, c.active AS clinic_active FROM users u JOIN clinics c ON c.id = u.clinic_id WHERE lower(u.email) = lower(?)', email);
  if (!u || !u.active || !u.clinic_active || !verifyPassword(password, u.password_hash)) {
    attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 10 * 60000 });
    return { error: 'Correo o contraseña incorrectos' };
  }
  attempts.delete(key);
  const token = randomBytes(32).toString('hex');
  const session = { userId: u.id, clinicId: u.clinic_id, role: u.role as Role, name: u.name, expires: Date.now() + TTL };
  sessions.set(token, session);
  return { token, session };
}
export function getSession(token: string | undefined): Session | undefined {
  if (!token) return undefined;
  const s = sessions.get(token);
  if (!s || s.expires < Date.now()) { sessions.delete(token); return undefined; }
  return s;
}
export const logout = (token: string | undefined): void => { if (token) sessions.delete(token); };
