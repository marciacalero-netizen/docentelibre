// Utilidades de fecha/hora y texto. Las citas se guardan en hora LOCAL de la clínica
// ("YYYY-MM-DDTHH:MM") para evitar errores de zona horaria en la demo.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nowLocal(tz: string, d: Date = new Date()): string {
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(d);
  return s.replace(' ', 'T');
}

const toUtc = (l: string): number => Date.parse(l.length === 10 ? `${l}T00:00:00Z` : `${l}:00Z`);
const fromUtc = (ms: number): string => new Date(ms).toISOString().slice(0, 16);

export const addMinutes = (l: string, m: number): string => fromUtc(toUtc(l) + m * 60000);
export const addDays = (date: string, n: number): string => fromUtc(toUtc(date.slice(0, 10)) + n * 86400000).slice(0, 10);
export const weekday = (date: string): number => new Date(toUtc(date.slice(0, 10))).getUTCDay();
export const minutesBetween = (a: string, b: string): number => (toUtc(b) - toUtc(a)) / 60000;

export function humanDate(l: string): string {
  const [d, t] = l.split('T');
  const dt = new Date(toUtc(d));
  return `${DIAS[dt.getUTCDay()]} ${dt.getUTCDate()} de ${MESES[dt.getUTCMonth()]}${t ? `, ${t}` : ''}`;
}
export const dayName = (wd: number): string => DIAS[wd];

export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Teléfonos: acepta «0991234567», «593991234567», «+593 99 123 4567»… y devuelve «+593991234567». Devuelve null si no es válido. */
export function normalizePhone(input: string): string | null {
  const s = String(input).replace(/[\s().-]/g, '');
  const e164 = /^0\d{9}$/.test(s) ? `+593${s.slice(1)}` : /^593\d{9}$/.test(s) ? `+${s}` : s.startsWith('+') ? s : /^\d{8,15}$/.test(s) ? `+${s}` : s;
  return /^\+\d{8,15}$/.test(e164) ? e164 : null;
}

export const nowIso = (d: Date = new Date()): string => d.toISOString();

export function money(n: number | null | undefined): string {
  if (n == null) return 'consultar';
  if (n === 0) return 'gratis';
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
