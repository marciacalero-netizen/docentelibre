import { normalize } from '../util.ts';
import type { Doctor } from '../services/clinic.ts';

export type Intent =
  | 'greeting' | 'book' | 'reschedule' | 'cancel' | 'my_appointments' | 'availability'
  | 'specialties' | 'doctors' | 'hours' | 'prices' | 'location' | 'human'
  | 'confirm_attendance' | 'thanks' | 'menu' | 'unknown';

const RULES: [Intent, RegExp][] = [
  ['human', /(humano|recepcion|recepcionista|una persona|asesor|operador|agente|hablar con alguien|atencion al cliente|persona real)/],
  ['confirm_attendance', /^(confirmo|confirmada|confirmado|asistire|ahi estare|alli estare)\b/],
  ['reschedule', /(reagend|reprogram|cambiar (la |mi )?(cita|hora|fecha|turno)|mover (la |mi )?cita|cambiar de (dia|hora|fecha))/],
  ['cancel', /(cancelar|anular|eliminar|ya no (voy|puedo|ire|necesito))/],
  ['my_appointments', /(mis citas|mi cita|proxima cita|cuando es mi cita|tengo (alguna )?cita|ver mi cita)/],
  ['book', /(agendar|reservar|sacar (una )?cita|pedir (una )?cita|solicitar (una )?cita|nueva cita|^cita$)/],
  ['availability', /(disponib|hay (cita|turno|espacio|horario)|proximo (turno|horario|espacio)|horarios? libres?|cuando (atiende|puede atender))/],
  ['prices', /(precio|costo|cuanto (cuesta|vale|cobra|cobran)|tarifa|valor de|cuanto es)/],
  ['location', /(ubicacion|direccion|donde (estan|queda|quedan|se ubica)|como llegar|mapa|ubicados)/],
  ['hours', /(horario|hora de atencion|a que hora|abren|cierran|atienden|atencion)/],
  ['doctors', /(medicos|doctores|doctoras|profesionales|especialistas|quienes (atienden|son))/],
  ['specialties', /(especialidad|servicios|que atienden|que ofrecen|que consultas)/],
  ['book', /((quiero|necesito|quisiera|me gustaria|deseo|busco).*(cita|turno|consulta|atencion medica|ver (a )?un)|cita con)/],
  ['thanks', /^(gracias|muchas gracias|ok gracias|listo gracias|vale gracias|genial gracias|perfecto gracias)\b/],
  ['menu', /^(hola|buenas|buenos|buen dia|hi|hello|menu|inicio|ayuda|opciones|volver|salir|empezar)\b/],
];

export function detectIntent(text: string): Intent {
  const n = normalize(text);
  for (const [intent, re] of RULES) if (re.test(n)) return intent;
  return 'unknown';
}

export const isYes = (text: string): boolean => /^(si|sii|acepto|ok|okay|confirmo|confirmar|confirmado|claro|dale|de acuerdo|correcto|listo|vale|perfecto|yes)\b/.test(normalize(text));
export const isNo = (text: string): boolean => /^(no|nop|nel|rechazo|no acepto|negativo|mejor no)\b/.test(normalize(text));
export const wantsMore = (text: string): boolean => /(^mas\b|mas horarios|otras|siguientes|otro horario|otros horarios|ver mas)/.test(normalize(text));
export const wantsMenu = (text: string): boolean => /^(menu|inicio|salir|volver|ayuda|opciones)\b/.test(normalize(text)) || normalize(text) === '0';

/** Interpreta "2", "opcion 2", "la 2", "2." ... */
export function parseChoice(text: string, max: number): number | null {
  const m = normalize(text).match(/^(?:opcion |la |el |numero |n )?(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= max ? n : null;
}

const stems = (name: string): string[] => normalize(name).split(' ').filter((t) => t.length >= 6).map((t) => t.slice(0, 5));

export function matchSpecialty<T extends { id: number; name: string }>(text: string, list: T[]): T | undefined {
  const n = normalize(text);
  const hits = list.filter((s) => normalize(s.name) === n || stems(s.name).some((st) => n.includes(st)));
  return hits.length === 1 ? hits[0] : undefined;
}

export function matchDoctor(text: string, list: Doctor[]): Doctor | undefined {
  const tokens = new Set(normalize(text).split(' '));
  const hits = list.filter((d) => normalize(d.name).split(' ').some((t) => t.length >= 4 && !['doctor', 'doctora'].includes(t) && tokens.has(t)));
  return hits.length === 1 ? hits[0] : undefined;
}

export function validName(text: string): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length < 5 || t.length > 60 || /\d/.test(t)) return null;
  if (!/^[\p{L}][\p{L}' .-]+$/u.test(t)) return null;
  if (t.split(' ').length < 2) return null;
  return t.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}
