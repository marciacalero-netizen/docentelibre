// Motor conversacional por reglas e intenciones. No usa servicios externos ni llamadas de voz.
// Punto de extensión: `understand()` puede sustituirse por un LLM con los mismos guardarraíles
// (safety.ts se ejecuta antes y la lógica de citas sigue siendo determinista).
import type { DB } from '../db.ts';
import { all, one, run } from '../db.ts';
import { dayName, humanDate, money, normalize, nowIso, nowLocal } from '../util.ts';
import type { Clinic, Doctor, Specialty } from '../services/clinic.ts';
import { doctorPrice, getClinic, getDoctor, hoursConfigured, isOpen, listDoctors, listSpecialties } from '../services/clinic.ts';
import { freeSlots, pickOptions } from '../services/availability.ts';
import type { Slot } from '../services/availability.ts';
import { cancelAppointment, createAppointment, rescheduleAppointment } from '../services/appointments.ts';
import { getOrCreateConversation, logMessage } from '../services/conversations.ts';
import { notify } from '../services/notify.ts';
import { enqueueCalendar } from '../integrations/google-calendar.ts';
import { MAX_DEPENDENTS, addDependent, holderByPhone, membersByPhone } from '../services/patients.ts';
import { assessSafety, diagnosisReply, emergencyReply } from './safety.ts';
import type { Intent } from './nlu.ts';
import { detectIntent, isNo, isYes, matchDoctor, matchSpecialty, parseChoice, validName, wantsMenu, wantsMore } from './nlu.ts';

const CONSENT_VERSION = 'LOPDP-v1';

interface State {
  flow: null | 'consent' | 'book' | 'reschedule' | 'cancel' | 'avail' | 'service';
  step: string;
  menu: boolean;
  fails: number;
  data: { text?: string; serviceId?: number; patientId?: number; newPerson?: boolean; specialtyId?: number; doctorId?: number; anyDoctor?: boolean; slot?: Slot; name?: string; offset?: number; rescheduleId?: number; cancelId?: number; then?: string };
  options: any[];
}
const freshState = (): State => ({ flow: null, step: '', menu: false, fails: 0, data: {}, options: [] });

interface Ctx { db: DB; clinic: Clinic; convId: number; phone: string; state: State; now: string; replies: string[]; say: (m: string) => void }

export interface BotResult { conversationId: number; replies: string[]; status: 'bot' | 'human' }

export function handleIncoming(db: DB, clinicId: number, phone: string, text: string, opts: { at?: string; now?: string } = {}): BotResult {
  const clinic = getClinic(db, clinicId);
  if (!clinic) throw new Error('Clínica no encontrada');
  const at = opts.at ?? nowIso();
  const conv = getOrCreateConversation(db, clinicId, phone, at);
  logMessage(db, clinicId, conv.id, { direction: 'in', sender: 'patient', body: text, at });
  let state: State = freshState();
  try { state = { ...freshState(), ...JSON.parse(conv.state) }; } catch { /* estado corrupto: se reinicia */ }
  const replies: string[] = [];
  const ctx: Ctx = { db, clinic, convId: conv.id, phone: conv.patient_phone, state, now: opts.now ?? nowLocal(clinic.timezone), replies, say: (m) => replies.push(m) };

  const safety = assessSafety(text);
  if (safety === 'self_harm' || safety === 'emergency') {
    emergency(ctx, safety, text);
  } else if (conv.status === 'human') {
    // Un recepcionista atiende esta conversación: el bot no interviene.
  } else {
    process(ctx, text, safety === 'diagnosis');
  }

  for (const r of replies) logMessage(db, clinicId, conv.id, { direction: 'out', sender: 'bot', body: r, at });
  run(db, 'UPDATE conversations SET state = ? WHERE clinic_id = ? AND id = ?', JSON.stringify(ctx.state), clinicId, conv.id);
  const status = one<{ status: 'bot' | 'human' }>(db, 'SELECT status FROM conversations WHERE clinic_id = ? AND id = ?', clinicId, conv.id)!.status;
  return { conversationId: conv.id, replies, status };
}

// ───────────────────────────── seguridad y derivación ─────────────────────────────

function emergency(ctx: Ctx, kind: 'self_harm' | 'emergency', text: string): void {
  ctx.say(emergencyReply(kind, ctx.clinic.settings.emergency_number));
  run(ctx.db, `UPDATE conversations SET flag = 'emergency' WHERE clinic_id = ? AND id = ?`, ctx.clinic.id, ctx.convId);
  const label = kind === 'self_harm' ? 'posible riesgo para la vida (salud mental)' : 'posible emergencia médica';
  notify(ctx.db, ctx.clinic.id, {
    type: 'emergency', level: 'urgent', conversationId: ctx.convId,
    title: `🚨 Alerta: ${label}`,
    body: `Un paciente escribió algo que sugiere ${label}. Se le indicó llamar al ${ctx.clinic.settings.emergency_number}. Revise la conversación y contáctelo si corresponde.`,
    target: isOpen(ctx.clinic, ctx.now) ? undefined : ctx.clinic.settings.oncall_whatsapp || undefined,
  });
  Object.assign(ctx.state, freshState());
  void text;
}

function handoff(ctx: Ctx, reason: string, area?: string): void {
  const { clinic } = ctx;
  const open = isOpen(clinic, ctx.now);
  if (clinic.settings.reception_whatsapp) return referToReception(ctx, reason, area, open);
  run(ctx.db, `UPDATE conversations SET status = 'human', had_handoff = 1, handoff_reason = ?, handoff_area = ? WHERE clinic_id = ? AND id = ?`, reason, area ?? null, clinic.id, ctx.convId);
  Object.assign(ctx.state, freshState());
  notify(ctx.db, clinic.id, { type: 'handoff', title: area ? `Paciente espera al área de ${area}` : 'Paciente espera a un recepcionista', body: `${area ? `Área: ${area}. ` : ''}Motivo: ${reason}.`, conversationId: ctx.convId });
  if (open) {
    ctx.say(area ? `Perfecto 🙌 Le comunico con el área de *${area}*. Una persona le escribirá en este mismo chat en unos minutos.` : 'Claro 🙋 Le comunico con el equipo de recepción. Un recepcionista le escribirá en este mismo chat en unos minutos.');
  } else {
    const s = clinic.settings;
    notify(ctx.db, clinic.id, {
      type: 'oncall', level: 'urgent', conversationId: ctx.convId, target: s.oncall_whatsapp || undefined,
      title: `Aviso a personal de guardia${s.oncall_name ? ` (${s.oncall_name})` : ''}`,
      body: `Un paciente pidió atención fuera de horario${area ? ` (área de ${area})` : ''}. Motivo: ${reason}. (Envío por WhatsApp al personal de guardia: simulado en esta versión.)`,
    });
    ctx.say(`En este momento estamos fuera de nuestro horario de atención 🌙. Ya avisé al personal de guardia${area ? ` para el área de *${area}*` : ''} y le responderán por este chat lo antes posible.\n\nSi se trata de una emergencia, llame al *${s.emergency_number}* (ECU 911).`);
  }
}

/** Enlace corto de WhatsApp (sin texto inicial) y número en formato local legible (0978 974 239). */
const waLink = (phone: string): string => `https://wa.me/${phone.replace(/\D/g, '')}`;
const localPhone = (phone: string): string => {
  const d = phone.replace(/\D/g, '');
  const l = d.startsWith('593') && d.length === 12 ? `0${d.slice(3)}` : d;
  return l.length === 10 ? `${l.slice(0, 4)} ${l.slice(4, 7)} ${l.slice(7)}` : l;
};

/** Hay WhatsApp de recepción: se entrega su enlace y la conversación termina aquí. */
function referToReception(ctx: Ctx, reason: string, area: string | undefined, open: boolean): void {
  const { clinic } = ctx;
  const num = clinic.settings.reception_whatsapp;
  Object.assign(ctx.state, freshState());
  notify(ctx.db, clinic.id, { type: 'referral', title: 'Paciente derivado al WhatsApp de recepción', body: `${area ? `Área: ${area}. ` : ''}Motivo: ${reason}. Se entregó el enlace; no se registraron datos del paciente.${open ? '' : ' Fuera del horario de atención.'}`, conversationId: ctx.convId });
  ctx.say(`Claro 🙋 Para hablar con una persona de recepción de ${clinic.name}, escríbale por WhatsApp:\n👉 ${waLink(num)}\no al número *${localPhone(num)}*.\n\n${open ? 'Le atenderá en breve.' : 'En este momento estamos fuera de nuestro horario de atención 🌙, pero le responderá lo antes posible.'}\n\nSi se trata de una emergencia, llame al *${clinic.settings.emergency_number}* (ECU 911). Para volver al inicio escriba *menú*.`);
}

// ───────────────────────────── despacho principal ─────────────────────────────

function process(ctx: Ctx, text: string, medicalTopic: boolean): void {
  const { state } = ctx;
  if (state.flow) return inFlow(ctx, text);

  let intent: Intent = detectIntent(text);
  if (state.menu) {
    const c = parseChoice(text, 7);
    if (c === 2) { state.fails = 0; return infoGeneral(ctx); }   // horarios, precios y ubicación
    if (c) intent = (['specialties', 'hours', 'availability', 'book', 'reschedule', 'cancel', 'human'] as Intent[])[c - 1];
  }
  if (medicalTopic && intent !== 'book' && intent !== 'human') {
    ctx.say(diagnosisReply(ctx.clinic.settings.emergency_number));
    state.menu = true;
    return;
  }
  if (medicalTopic && intent === 'book') ctx.say('Claro, le ayudo a agendar. No necesito detalles clínicos por aquí: el médico los revisará en su consulta. 💙');
  if (intent !== 'unknown') state.fails = 0;

  // Servicios sin cita o de atención directa con el área (p. ej. Odontología, Laboratorio, Rayos X)
  if (['unknown', 'book', 'availability', 'prices', 'hours', 'results'].includes(intent)) {
    const svc = matchSpecialty(text, listSpecialties(ctx.db, ctx.clinic.id).filter((s) => !isBookable(ctx, s)));
    if (svc && !(intent === 'results' && svc.kind === 'handoff')) return startService(ctx, svc);
  }

  switch (intent) {
    case 'results': return infoResults(ctx);
    case 'human': return handoff(ctx, 'El paciente solicitó hablar con una persona');
    case 'book': return startBook(ctx, text);
    case 'reschedule': return startReschedule(ctx);
    case 'cancel': return startCancel(ctx);
    case 'availability': return startAvailability(ctx, text);
    case 'my_appointments': return showMyAppointments(ctx);
    case 'confirm_attendance': return confirmAttendance(ctx);
    case 'specialties': return infoSpecialties(ctx);
    case 'doctors': return infoDoctors(ctx);
    case 'hours': return infoHours(ctx);
    case 'prices': return infoPrices(ctx);
    case 'location': return infoLocation(ctx);
    case 'thanks': ctx.say('¡Con gusto! 😊 Si necesita algo más, escriba *menú*.'); return;
    case 'greeting':
    case 'menu': return showMenu(ctx, true);
    default: {
      state.fails++;
      if (state.fails >= 2) { state.fails = 0; ctx.say('Parece que no logro entenderle 😅. Si prefiere, escriba *recepción* y una persona le atenderá.'); return; }
      ctx.say('No estoy seguro de haber entendido 🤔. Estas son las opciones disponibles:');
      return showMenu(ctx, false);
    }
  }
}

function showMenu(ctx: Ctx, welcome: boolean): void {
  const { clinic } = ctx;
  const who = clinic.settings.assistant_name ? `Soy *${clinic.settings.assistant_name}*, el asistente virtual de *${clinic.name}*` : `Soy el asistente virtual de *${clinic.name}*`;
  const head = welcome ? `¡Hola! 👋 ${who}. Atiendo por WhatsApp las 24 horas.\n\n¿En qué puedo ayudarle?` : '';
  ctx.say(`${head}${head ? '\n\n' : ''}*1.* Especialidades y servicios\n*2.* Horarios, precios y ubicación\n*3.* Ver disponibilidad\n*4.* Agendar una cita\n*5.* Reagendar una cita\n*6.* Cancelar una cita\n*7.* Hablar con recepción\n\nResponda con el número o escríbame su consulta.`);
  ctx.state.menu = true;
}

function inFlow(ctx: Ctx, text: string): void {
  const { state } = ctx;
  if (wantsMenu(text)) { Object.assign(state, freshState()); return showMenu(ctx, false); }
  if (detectIntent(text) === 'human') return handoff(ctx, 'El paciente solicitó hablar con una persona durante un trámite');
  if (state.flow !== 'cancel' && state.flow !== 'consent' && /^cancelar\b/.test(normalize(text))) {
    Object.assign(state, freshState());
    ctx.say('Listo, detuve el trámite. Escriba *menú* cuando desee continuar.');
    return;
  }
  switch (state.flow) {
    case 'consent': return consentInput(ctx, text);
    case 'book': case 'reschedule': return bookInput(ctx, text);
    case 'cancel': return cancelInput(ctx, text);
    case 'avail': return availInput(ctx, text);
    case 'service': return serviceInput(ctx, text);
  }
}

function fail(ctx: Ctx, hint: string, rerender: () => void): void {
  ctx.state.fails++;
  if (ctx.state.fails >= 3) {
    ctx.state.fails = 0;
    ctx.say('Parece que tengo dificultades para ayudarle con esto 😅. Escriba *recepción* para que una persona le atienda o *menú* para volver al inicio.');
    return;
  }
  ctx.say(hint);
  rerender();
}

// ───────────────────────────── información ─────────────────────────────

const label = (s: Specialty): string => `${s.emoji ? s.emoji + ' ' : ''}${s.name}`;
const priceTag = (p: number | null | undefined): string => (p != null ? ` — ${money(p)}` : '');
/** Servicios con médicos cargados (para agendar) o de atención directa / sin cita (para informar). */
/** Un servicio «con cita» solo se agenda si tiene al menos un médico activo; si aún no lo tiene, se informa como «próximamente». */
const isBookable = (ctx: Ctx, s: Specialty): boolean => s.kind === 'appointment' && listDoctors(ctx.db, ctx.clinic.id).some((d) => d.specialty_id === s.id);
const bookableServices = (ctx: Ctx): Specialty[] => {
  const all_ = listSpecialties(ctx.db, ctx.clinic.id);
  return [...all_.filter((s) => isBookable(ctx, s)), ...all_.filter((s) => !isBookable(ctx, s))];   // primero lo que se agenda, luego el resto
};

const OTHER_TITLE = '*Otros servicios* (sin cita o con el área)';

/** Lista numerada en dos bloques: «Citas médicas» y «Otros servicios». La numeración es continua. */
function sectioned(ctx: Ctx, list: Specialty[], line: (s: Specialty) => string): string {
  const appt = list.filter((s) => isBookable(ctx, s)), other = list.filter((s) => !isBookable(ctx, s));
  let i = 0;
  const block = (title: string, items: Specialty[]) => (items.length ? `${title}\n${items.map((s) => `*${++i}.* ${line(s)}`).join('\n')}` : '');
  return [block('*Citas médicas*', appt), block(OTHER_TITLE, other)].filter(Boolean).join('\n\n');
}

function infoSpecialties(ctx: Ctx): void {
  const sp = listSpecialties(ctx.db, ctx.clinic.id);
  const appt = sp.filter((s) => isBookable(ctx, s)), other = sp.filter((s) => !isBookable(ctx, s));
  const aLine = (s: Specialty) => `• ${label(s)}${priceTag(s.price)}${s.description ? `\n  ${s.description}` : ''}`;
  const oLine = (s: Specialty) => `• ${label(s)}${s.kind === 'walkin' ? ' — _sin cita_' : s.kind === 'appointment' ? ' — _próximamente_' : ''}`;
  const body = [appt.length ? `*Citas médicas*\n${appt.map(aLine).join('\n')}` : '', other.length ? `${OTHER_TITLE}\n${other.map(oLine).join('\n')}` : ''].filter(Boolean).join('\n\n');
  ctx.say(`*Especialidades y servicios de ${ctx.clinic.name}*\n\n${body}\n\nPara reservar escriba *agendar*; para ver los médicos escriba *médicos*.`);
}

/** «lun–vie 08:00–13:00 y 14:00–18:00 · sáb 08:00–12:00»: agrupa días iguales y compacta días seguidos. */
function doctorDays(db: DB, clinicId: number, doctorId: number): string {
  const rows = all<{ weekday: number; start_time: string; end_time: string }>(db, 'SELECT weekday, start_time, end_time FROM schedules WHERE clinic_id = ? AND doctor_id = ? ORDER BY ((weekday + 6) % 7), start_time', clinicId, doctorId);
  if (!rows.length) return 'sin horario fijo (se confirma en recepción)';
  const byDay = new Map<number, string[]>();
  for (const r of rows) byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), `${r.start_time}–${r.end_time}`]);
  const groups = new Map<string, number[]>();
  for (const [d, ranges] of byDay) groups.set(ranges.join(' y '), [...(groups.get(ranges.join(' y ')) ?? []), d]);
  const abbr = (d: number) => dayName(d).slice(0, 3);
  const days = (ds: number[]): string => {
    const ord = [...ds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)), out: string[] = [];
    for (let i = 0; i < ord.length;) {
      let j = i; while (j + 1 < ord.length && (ord[j + 1] + 6) % 7 === ((ord[j] + 6) % 7) + 1) j++;
      out.push(...(j - i >= 2 ? [`${abbr(ord[i])}–${abbr(ord[j])}`] : ord.slice(i, j + 1).map(abbr)));
      i = j + 1;
    }
    return out.length > 1 ? `${out.slice(0, -1).join(', ')} y ${out[out.length - 1]}` : out[0];
  };
  return [...groups].map(([ranges, ds]) => `${days(ds)} ${ranges}`).join(' · ');
}
const KIND_TAG: Record<string, string> = { appointment: 'con cita previa', walkin: 'sin cita', handoff: 'atención directa con el área' };

function infoDoctors(ctx: Ctx): void {
  const docs = listDoctors(ctx.db, ctx.clinic.id);
  if (!docs.length) return ctx.say('Aún no tengo cargada la lista de médicos. Escriba *recepción* y una persona le informará.');
  // Un mismo profesional puede atender varias especialidades: se agrupa por nombre.
  const kinds = new Map(listSpecialties(ctx.db, ctx.clinic.id).map((s) => [s.id, s.kind]));
  const byName = new Map<string, Doctor[]>();
  for (const d of docs) byName.set(d.name, [...(byName.get(d.name) ?? []), d]);
  const block = ([name, list]: [string, Doctor[]]) => `• *${name}*\n${list.map((d) => `  – ${d.specialty_name} (${KIND_TAG[kinds.get(d.specialty_id) ?? 'appointment']}): ${doctorDays(ctx.db, ctx.clinic.id, d.id)}${doctorPrice(d) != null ? ` · ${money(doctorPrice(d))}` : ''}`).join('\n')}`;
  ctx.say(`*Nuestros profesionales*\n\n${[...byName].map(block).join('\n')}\n\nPara reservar con cita previa escriba *agendar*.`);
}

function infoHours(ctx: Ctx): void {
  if (!hoursConfigured(ctx.clinic)) return ctx.say('Aún no tengo cargado el horario de recepción. Escriba *recepción* y una persona se lo confirmará.');
  const h = ctx.clinic.settings.hours;
  const lines = [1, 2, 3, 4, 5, 6, 0].map((d) => `• ${dayName(d)[0].toUpperCase() + dayName(d).slice(1)}: ${(h[String(d)] ?? []).map(([a, b]) => `${a}–${b}`).join(', ') || 'cerrado'}`);
  ctx.say(`*Horario de atención de recepción*\n${lines.join('\n')}\n\nEste asistente responde las 24 horas. ${isOpen(ctx.clinic, ctx.now) ? 'Ahora mismo recepción está *abierta* ✅.' : 'Ahora mismo recepción está *cerrada* 🌙, pero puedo agendar su cita.'}`);
}

function infoPrices(ctx: Ctx): void {
  const docs = listDoctors(ctx.db, ctx.clinic.id);
  const all = listSpecialties(ctx.db, ctx.clinic.id);
  const rows = all.map((s) => {
    const ps = docs.filter((d) => d.specialty_id === s.id).map((d) => doctorPrice(d)).filter((x): x is number => x != null);
    const vals = ps.length ? ps : s.price != null ? [s.price] : [];
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals);
    return `• ${label(s)}: ${min === max ? money(min) : `${money(min)} – ${money(max)}`}`;
  }).filter(Boolean);
  const extra = ctx.clinic.settings.prices_extra.trim();
  const noPrice = all.filter((s) => s.kind !== 'appointment' && s.price == null && !docs.some((d) => d.specialty_id === s.id && doctorPrice(d) != null)).map(label);
  const area = noPrice.length ? `\nPara ${noPrice.join(', ')} consulte los valores con el área.` : '';
  if (!rows.length && !extra) return ctx.say(`Aún no tengo cargados los valores. Escriba *recepción* y una persona se los confirmará.${area}`);
  ctx.say(`${rows.length ? `*Valor de la consulta*\n${rows.join('\n')}\n` : ''}${extra ? `\n*Otros servicios*\n${extra}\n` : ''}\nLos valores pueden variar según el profesional o el examen.${area}`);
}

function infoGeneral(ctx: Ctx): void { infoHours(ctx); infoPrices(ctx); infoLocation(ctx); }

function infoResults(ctx: Ctx): void {
  ctx.say(`${ctx.clinic.settings.results_text}\n\nSi desea que una persona le ayude, escriba *recepción*.`);
}

// Servicios sin cita (walkin) o de atención directa con el área (handoff): el agente no agenda; informa y ofrece pasar al área.
function startService(ctx: Ctx, sp: Specialty): void {
  Object.assign(ctx.state, freshState(), { flow: 'service', step: 'continue', data: { serviceId: sp.id } });
  renderService(ctx, sp);
}

function renderService(ctx: Ctx, sp: Specialty): void {
  let lead = sp.info;
  if (!lead && sp.kind === 'appointment') lead = `${label(sp)} se atiende con *cita previa*, pero todavía estamos confirmando al profesional y su horario, así que por ahora no puedo agendarle. Puedo comunicarle con recepción para que le avisen apenas esté disponible.`;
  if (!lead && sp.kind === 'handoff') lead = `Para información, disponibilidad y citas de ${label(sp)}, puedo comunicarle directamente con el área correspondiente.`;
  if (!lead) {   // sin cita: se informa quién atiende y en qué días y horas, según lo cargado en Médicos
    const docs = listDoctors(ctx.db, ctx.clinic.id).filter((d) => d.specialty_id === sp.id);
    lead = `${label(sp)} se atiende *sin cita*, por orden de llegada.${docs.length ? `\n\n${docs.map((d) => `• *${d.name}*: ${doctorDays(ctx.db, ctx.clinic.id, d.id)}`).join('\n')}` : '\n\nEl horario lo confirma recepción.'}`;
  }
  const first = sp.kind === 'handoff' ? `Continuar con ${label(sp)}` : sp.contact_whatsapp ? 'Hablar con una persona del área' : 'Hablar con recepción';
  ctx.say(`${lead}\n\n*1.* ${first}\n*2.* Volver al menú`);
}

/** El área tiene su propio WhatsApp: se entrega el enlace y la conversación termina aquí. No se guarda ningún dato del paciente. */
function referToArea(ctx: Ctx, sp: Specialty): void {
  const { clinic } = ctx;
  const num = sp.contact_whatsapp!;
  Object.assign(ctx.state, freshState());
  notify(ctx.db, clinic.id, { type: 'referral', title: `Paciente derivado al WhatsApp de ${sp.name}`, body: `Se entregó el enlace al WhatsApp del área de ${sp.name}. No se registraron datos del paciente.`, conversationId: ctx.convId });
  ctx.say(`Perfecto 🙌 Para continuar con *${label(sp)}*, escríbale directamente al área por WhatsApp:\n👉 ${waLink(num)}\no al número *${localPhone(num)}*.\n\nSi prefiere que le ayude una persona de recepción de ${clinic.name}, escriba *recepción*. Para volver al inicio escriba *menú*.`);
}

function serviceInput(ctx: Ctx, text: string): void {
  const sp = listSpecialties(ctx.db, ctx.clinic.id).find((s) => s.id === ctx.state.data.serviceId);
  if (!sp) { Object.assign(ctx.state, freshState()); return showMenu(ctx, false); }
  const c = parseChoice(text, 2);
  if (c === 1 || isYes(text) || /^continuar/.test(normalize(text))) return sp.contact_whatsapp ? referToArea(ctx, sp) : sp.kind === 'walkin' ? handoff(ctx, `Consulta sobre ${sp.name} (se atiende sin cita)`) : sp.kind === 'appointment' ? handoff(ctx, `Consulta sobre ${sp.name} (aún sin profesional cargado)`) : handoff(ctx, `Consulta del área de ${sp.name}`, sp.name);
  if (c === 2 || isNo(text)) { Object.assign(ctx.state, freshState()); return showMenu(ctx, false); }
  fail(ctx, 'Responda *1* para continuar o *2* para volver al menú.', () => renderService(ctx, sp));
}

function infoLocation(ctx: Ctx): void {
  const c = ctx.clinic;
  ctx.say(`📍 *${c.name}*\n${c.address ?? ''}${c.city ? `, ${c.city}` : ''}${c.maps_url ? `\n🗺️ ${c.maps_url}` : ''}\n\nLe recomendamos llegar 10 minutos antes de su cita.`);
}

// ───────────────────────────── pacientes y consentimiento ─────────────────────────────

const getHolder = (ctx: Ctx) => holderByPhone(ctx.db, ctx.clinic.id, ctx.phone);
const getMembers = (ctx: Ctx) => membersByPhone(ctx.db, ctx.clinic.id, ctx.phone);

function consentText(ctx: Ctx): string {
  return `Para continuar necesito registrar sus datos (su nombre y su número de WhatsApp) con el único fin de gestionar sus citas en *${ctx.clinic.name}*.\n\n🔒 Se tratan conforme a la Ley Orgánica de Protección de Datos Personales de Ecuador (LOPDP), no se comparten con terceros no autorizados y puede pedir acceso, rectificación o eliminación cuando lo desee escribiendo *recepción*. *No le pediré información médica por este chat.*\n\n¿Acepta? Responda *SI* o *NO*.`;
}

function consentInput(ctx: Ctx, text: string): void {
  const { state } = ctx;
  if (isYes(text)) {
    const existing = getHolder(ctx);
    if (existing) run(ctx.db, 'UPDATE patients SET consent_at = ?, consent_version = ? WHERE clinic_id = ? AND id = ?', nowIso(), CONSENT_VERSION, ctx.clinic.id, existing.id);
    else run(ctx.db, 'INSERT INTO patients (clinic_id, phone, consent_at, consent_version, created_at) VALUES (?,?,?,?,?)', ctx.clinic.id, ctx.phone, nowIso(), CONSENT_VERSION, nowIso());
    run(ctx.db, 'UPDATE conversations SET patient_id = ? WHERE clinic_id = ? AND id = ?', getHolder(ctx)!.id, ctx.clinic.id, ctx.convId);
    const next = state.data.then, firstText = state.data.text ?? '';
    Object.assign(state, freshState());
    ctx.say('Gracias, su autorización quedó registrada ✅.');
    if (next === 'book') startBook(ctx, firstText);   // conserva lo que el paciente pidió en su primer mensaje (p. ej. «pediatra»)
    else if (next === 'reschedule') startReschedule(ctx);
  } else if (isNo(text)) {
    Object.assign(state, freshState());
    ctx.say('Entendido. Sin su autorización no puedo registrar datos ni agendar por este medio. Puedo darle información general (escriba *menú*) o puede escribir *recepción* para que una persona le ayude.');
  } else {
    fail(ctx, 'Necesito que responda *SI* o *NO*: ¿acepta que registremos su nombre y su número de WhatsApp para gestionar sus citas?', () => {});
  }
}

// ───────────────────────────── agendar / reagendar ─────────────────────────────

function startBook(ctx: Ctx, text: string): void {
  const { state } = ctx;
  const patient = getHolder(ctx);
  if (!patient?.consent_at) {
    Object.assign(state, freshState(), { flow: 'consent', step: 'consent', data: { then: 'book', text } });
    return ctx.say(consentText(ctx));
  }
  Object.assign(state, freshState(), { flow: 'book' });
  const specs = listSpecialties(ctx.db, ctx.clinic.id).filter((s) => s.kind === 'appointment'), docs = listDoctors(ctx.db, ctx.clinic.id);
  const doc = matchDoctor(text, docs);
  if (doc) { state.data.doctorId = doc.id; state.data.specialtyId = doc.specialty_id; }
  else { const sp = matchSpecialty(text, specs); if (sp) state.data.specialtyId = sp.id; }
  advanceBook(ctx);
}

function advanceBook(ctx: Ctx): void {
  const { state, db, clinic } = ctx;
  const d = state.data;
  if (state.flow === 'book') {
    if (!d.patientId && !d.newPerson) return askWho(ctx);
    if (!d.name && (d.newPerson || !getMembers(ctx).find((m) => m.id === d.patientId)?.name)) {
      state.step = 'name';
      return ctx.say(d.newPerson ? 'Perfecto. ¿Cuál es el *nombre y apellido* de la persona que será atendida?' : 'Perfecto. ¿Cuál es su *nombre y apellido*?');
    }
    if (!d.specialtyId) {
      const specs = bookableServices(ctx);
      if (!specs.length) { Object.assign(state, freshState()); return ctx.say('Por ahora no hay médicos disponibles para agendar por este medio. Escriba *recepción* para que le ayuden.'); }
      state.step = 'specialty'; state.options = specs.map((s) => s.id);
      return ctx.say(`¿Con qué especialidad o servicio desea su cita?\n\n${sectioned(ctx, specs, (s) => `${label(s)}${isBookable(ctx, s) ? priceTag(s.price) : ''}`)}\n\nResponda con el número o el nombre. (Escriba *menú* para salir)`);
    }
    if (!d.doctorId && !d.anyDoctor) {
      const docs = listDoctors(db, clinic.id).filter((x) => x.specialty_id === d.specialtyId);
      if (docs.length === 1) { d.doctorId = docs[0].id; }
      else {
        state.step = 'doctor'; state.options = docs.map((x) => x.id);
        return ctx.say(`¿Con qué profesional?\n\n${docs.map((x, i) => `*${i + 1}.* ${x.name} — ${money(doctorPrice(x))}`).join('\n')}\n*${docs.length + 1}.* Cualquiera (el primer horario disponible)`);
      }
    }
  }
  if (!d.slot) return showSlots(ctx);
  return renderConfirm(ctx);
}

/** ¿Para quién es la cita? Un número de WhatsApp puede agendar para el titular y sus familiares. */
function askWho(ctx: Ctx): void {
  const members = getMembers(ctx);
  ctx.state.step = 'who'; ctx.state.options = members.map((m) => m.id);
  const lines = members.map((m, i) => `*${i + 1}.* ${m.is_holder ? `Para mí${m.name ? ` (${m.name})` : ''}` : `Para ${m.name}`}`);
  ctx.say(`¿Para quién es la cita?\n\n${lines.join('\n')}\n*${members.length + 1}.* Para otra persona (un familiar)`);
}

function slotDoctorIds(ctx: Ctx): number[] {
  const d = ctx.state.data;
  if (d.doctorId) return [d.doctorId];
  return listDoctors(ctx.db, ctx.clinic.id).filter((x) => x.specialty_id === d.specialtyId).map((x) => x.id);
}

function showSlots(ctx: Ctx): void {
  const { state, db, clinic } = ctx;
  const d = state.data;
  const slots = freeSlots(db, clinic, slotDoctorIds(ctx), { excludeAppointmentId: d.rescheduleId, now: ctx.now });
  let opts = pickOptions(slots, d.offset ?? 0, 6, d.doctorId ? 3 : 4);
  let note = '';
  if (!opts.length && (d.offset ?? 0) > 0) { d.offset = 0; opts = pickOptions(slots, 0, 6, d.doctorId ? 3 : 4); note = 'Ya no hay más horarios; vuelvo al inicio de la lista.\n\n'; }
  if (!opts.length) {
    Object.assign(state, freshState());
    return ctx.say(`😔 No encontré horarios disponibles en los próximos ${clinic.settings.booking_window_days} días. Escriba *recepción* para que una persona le ayude a encontrar un espacio.`);
  }
  state.step = 'slot'; state.options = opts;
  const single = !!d.doctorId;
  const who = single ? ` con ${getDoctor(db, clinic.id, d.doctorId!)?.name}` : '';
  ctx.say(`${note}Estos son los próximos horarios disponibles${who}:\n\n${opts.map((s: Slot, i: number) => `*${i + 1}.* ${humanDate(s.start)}${single ? '' : ` — ${getDoctor(db, clinic.id, s.doctorId)?.name}`}`).join('\n')}\n\nResponda con el *número* de su elección o *MÁS* para ver otros horarios.`);
}

function renderConfirm(ctx: Ctx): void {
  const { state, db, clinic } = ctx;
  const d = state.data;
  const doc = getDoctor(db, clinic.id, d.slot!.doctorId)!;
  const who = d.name ?? getMembers(ctx).find((m) => m.id === d.patientId)?.name;
  const rep = d.newPerson ? '\n👪 Registraré a esta persona como paciente bajo su número. Al confirmar declara ser su representante o contar con su autorización para tratar sus datos para gestionar sus citas.\n' : '';
  state.step = 'confirm';
  ctx.say(`Por favor confirme los datos:\n\n${state.flow === 'reschedule' ? '🔁 *Reagendar cita*\n' : ''}👤 ${who}\n🩺 ${doc.name} (${doc.specialty_name})\n📅 ${humanDate(d.slot!.start)}\n💵 ${money(doctorPrice(doc))}\n${rep}\n¿Confirma? Responda *SI* o *NO*.`);
}

function bookInput(ctx: Ctx, text: string): void {
  const { state, db, clinic } = ctx;
  const d = state.data;
  switch (state.step) {
    case 'who': {
      const c = parseChoice(text, state.options.length + 1);
      if (!c) return fail(ctx, 'Responda con el número de una de las opciones.', () => askWho(ctx));
      if (c === state.options.length + 1) {
        if (getMembers(ctx).filter((m) => !m.is_holder).length >= MAX_DEPENDENTS) { Object.assign(state, freshState()); return ctx.say(`Por seguridad solo puedo registrar hasta ${MAX_DEPENDENTS} familiares por número. Escriba *recepción* para que le ayuden.`); }
        d.newPerson = true;
      } else d.patientId = state.options[c - 1];
      state.fails = 0; return advanceBook(ctx);
    }
    case 'specialty': {
      const c = parseChoice(text, state.options.length);
      const all_ = listSpecialties(db, clinic.id).filter((s) => state.options.includes(s.id));
      const sp = c ? all_.find((s) => s.id === state.options[c - 1]) : matchSpecialty(text, all_);
      if (!sp) return fail(ctx, 'No identifiqué esa especialidad.', () => advanceBook(ctx));
      if (!isBookable(ctx, sp)) return startService(ctx, sp);
      d.specialtyId = sp.id; state.fails = 0; return advanceBook(ctx);
    }
    case 'doctor': {
      const c = parseChoice(text, state.options.length + 1);
      if (c === state.options.length + 1 || /^(cualquiera|cualquier|el primero|indistinto)/.test(normalize(text))) { d.anyDoctor = true; state.fails = 0; return advanceBook(ctx); }
      const doc = c ? { id: state.options[c - 1] } : matchDoctor(text, listDoctors(db, clinic.id).filter((x) => state.options.includes(x.id)));
      if (!doc) return fail(ctx, 'No identifiqué ese profesional.', () => advanceBook(ctx));
      d.doctorId = doc.id; state.fails = 0; return advanceBook(ctx);
    }
    case 'slot': {
      if (wantsMore(text)) { d.offset = (d.offset ?? 0) + 6; return showSlots(ctx); }
      const c = parseChoice(text, state.options.length);
      if (!c) return fail(ctx, 'Responda con el número de uno de los horarios.', () => showSlots(ctx));
      d.slot = state.options[c - 1]; state.fails = 0; return advanceBook(ctx);
    }
    case 'name': {
      const name = validName(text);
      if (!name) return fail(ctx, 'Escriba el *nombre y apellido*, por favor (solo letras, sin números).', () => {});
      const same = getMembers(ctx).find((m) => m.name && normalize(m.name) === normalize(name));
      if (d.newPerson && same) { d.patientId = same.id; d.newPerson = false; ctx.say(`Ya tengo registrado a *${same.name}* bajo este número; la cita será para esa persona.`); }
      else d.name = name;
      state.fails = 0; return advanceBook(ctx);
    }
    case 'confirm': {
      if (isNo(text)) { d.slot = undefined; ctx.say('Sin problema, busquemos otro horario.'); return showSlots(ctx); }
      if (!isYes(text)) return fail(ctx, 'Responda *SI* para confirmar o *NO* para elegir otro horario.', () => renderConfirm(ctx));
      return finishBooking(ctx);
    }
    case 'pick': {
      const c = parseChoice(text, state.options.length);
      if (!c) return fail(ctx, 'Responda con el número de la cita.', () => renderPick(ctx, 'cambiar'));
      d.rescheduleId = state.options[c - 1]; return startRescheduleSlots(ctx);
    }
  }
}

function finishBooking(ctx: Ctx): void {
  const { state, db, clinic } = ctx;
  const d = state.data;
  const slot = d.slot!;
  let patientId = d.patientId;
  if (state.flow === 'book') {
    if (d.newPerson) {
      const r = addDependent(db, clinic.id, getHolder(ctx)!, d.name!);
      if (!r.ok) { Object.assign(state, freshState()); return ctx.say(`${r.error}. Escriba *recepción* para que le ayuden.`); }
      patientId = r.id; d.patientId = r.id; d.newPerson = false;
    } else if (d.name) {
      run(db, 'UPDATE patients SET name = ? WHERE clinic_id = ? AND id = ? AND name IS NULL', d.name, clinic.id, patientId);
    }
  }
  const res = state.flow === 'reschedule'
    ? rescheduleAppointment(db, clinic, d.rescheduleId!, slot.start)
    : createAppointment(db, clinic, { doctorId: slot.doctorId, patientId: patientId!, start: slot.start, source: 'whatsapp' });
  if (!res.ok) {
    d.slot = undefined;
    ctx.say(`😕 ${res.error}. Elijamos otro horario.`);
    return showSlots(ctx);
  }
  const doc = getDoctor(db, clinic.id, slot.doctorId)!;
  const was = state.flow;
  Object.assign(state, freshState());
  ctx.say(`✅ *${was === 'reschedule' ? 'Cita reagendada' : 'Cita confirmada'}*\n\n🩺 ${doc.name} (${doc.specialty_name})\n📅 ${humanDate(slot.start)}\n📍 ${clinic.address ?? clinic.name}${clinic.city ? `, ${clinic.city}` : ''}\n💵 ${money(doctorPrice(doc))}\n\nLe enviaré un recordatorio ${clinic.settings.reminder_hours} horas antes. Para reagendar o cancelar, escríbame por aquí. Llegue 10 minutos antes. 😊`);
}

function upcoming(ctx: Ctx): any[] {
  const members = getMembers(ctx);
  if (!members.length) return [];
  const rows = all<any>(ctx.db, `SELECT a.id, a.start_at, a.confirmed, a.reminder_sent, p.name AS patient_name, d.name AS doctor_name, s.name AS specialty_name FROM appointments a
    JOIN patients p ON p.clinic_id = a.clinic_id AND p.id = a.patient_id
    JOIN doctors d ON d.clinic_id = a.clinic_id AND d.id = a.doctor_id
    JOIN specialties s ON s.clinic_id = d.clinic_id AND s.id = d.specialty_id
    WHERE a.clinic_id = ? AND a.patient_id IN (${members.map(() => '?').join(',')}) AND a.status = 'scheduled' AND a.start_at >= ? ORDER BY a.start_at`, ctx.clinic.id, ...members.map((m) => m.id), ctx.now);
  rows.forEach((r) => { r.show_name = members.length > 1; });
  return rows;
}

const apptLine = (a: any, i?: number) => `${i != null ? `*${i + 1}.* ` : '• '}${a.show_name && a.patient_name ? `${a.patient_name}: ` : ''}${humanDate(a.start_at)} — ${a.doctor_name} (${a.specialty_name})${a.confirmed ? ' ✔' : ''}`;

function showMyAppointments(ctx: Ctx): void {
  const list = upcoming(ctx);
  if (!list.length) return ctx.say('No encuentro citas próximas asociadas a este número. Escriba *agendar* para reservar una.');
  ctx.say(`*Sus próximas citas*\n\n${list.map((a) => apptLine(a)).join('\n')}\n\nPuedo *reagendar* o *cancelar* si lo necesita.`);
}

function renderPick(ctx: Ctx, verb: string): void {
  const list = upcoming(ctx);
  ctx.state.step = 'pick'; ctx.state.options = list.map((a) => a.id);
  ctx.say(`¿Cuál cita desea ${verb}?\n\n${list.map((a, i) => apptLine(a, i)).join('\n')}`);
}

function startReschedule(ctx: Ctx): void {
  const list = upcoming(ctx);
  Object.assign(ctx.state, freshState());
  if (!list.length) return ctx.say('No encuentro citas próximas asociadas a este número. Escriba *agendar* para reservar una nueva.');
  ctx.state.flow = 'reschedule';
  if (list.length === 1) { ctx.state.data.rescheduleId = list[0].id; return startRescheduleSlots(ctx); }
  renderPick(ctx, 'cambiar');
}

function startRescheduleSlots(ctx: Ctx): void {
  const a = one<any>(ctx.db, 'SELECT doctor_id, patient_id, start_at FROM appointments WHERE clinic_id = ? AND id = ?', ctx.clinic.id, ctx.state.data.rescheduleId);
  if (!a || !getMembers(ctx).some((m) => m.id === a.patient_id)) { Object.assign(ctx.state, freshState()); return ctx.say('No pude encontrar esa cita.'); }
  ctx.state.data.doctorId = a.doctor_id; ctx.state.data.patientId = a.patient_id;
  ctx.say(`Vamos a cambiar su cita del *${humanDate(a.start_at)}*.`);
  showSlots(ctx);
}

// ───────────────────────────── cancelar ─────────────────────────────

function startCancel(ctx: Ctx): void {
  const list = upcoming(ctx);
  Object.assign(ctx.state, freshState());
  if (!list.length) return ctx.say('No encuentro citas próximas asociadas a este número.');
  ctx.state.flow = 'cancel';
  if (list.length === 1) return renderCancelConfirm(ctx, list[0]);
  renderPick(ctx, 'cancelar');
}

function renderCancelConfirm(ctx: Ctx, a: any): void {
  ctx.state.data.cancelId = a.id; ctx.state.step = 'confirm';
  ctx.say(`¿Confirma que desea *cancelar* esta cita?\n\n${apptLine(a)}\n\nResponda *SI* para cancelar o *NO* para conservarla.`);
}

function cancelInput(ctx: Ctx, text: string): void {
  const { state } = ctx;
  if (state.step === 'pick') {
    const c = parseChoice(text, state.options.length);
    if (!c) return fail(ctx, 'Responda con el número de la cita.', () => renderPick(ctx, 'cancelar'));
    const a = upcoming(ctx).find((x) => x.id === state.options[c - 1]);
    if (!a) { Object.assign(state, freshState()); return ctx.say('No pude encontrar esa cita.'); }
    state.fails = 0; return renderCancelConfirm(ctx, a);
  }
  const a = upcoming(ctx).find((x) => x.id === state.data.cancelId);
  if (isYes(text) && a) {
    cancelAppointment(ctx.db, ctx.clinic.id, a.id);
    notify(ctx.db, ctx.clinic.id, { type: 'cancellation', title: 'Cita cancelada por WhatsApp', body: `${humanDate(a.start_at)} con ${a.doctor_name}. El horario quedó libre.`, conversationId: ctx.convId });
    Object.assign(state, freshState());
    ctx.say('Su cita fue *cancelada* ✅. Cuando desee reservar otra, escriba *agendar*.');
  } else if (isNo(text)) {
    Object.assign(state, freshState());
    ctx.say('Perfecto, su cita se mantiene. 😊');
  } else {
    fail(ctx, 'Responda *SI* para cancelar o *NO* para conservarla.', () => a && renderCancelConfirm(ctx, a));
  }
}

function confirmAttendance(ctx: Ctx): void {
  const pending = upcoming(ctx).filter((a) => !a.confirmed);
  if (!pending.length) return ctx.say('No tengo citas pendientes de confirmación para este número. Escriba *menú* para ver opciones.');
  // Si se enviaron recordatorios, se confirman las citas recordadas (puede haber varias familiares); si no, la más próxima.
  const targets = pending.some((a) => a.reminder_sent) ? pending.filter((a) => a.reminder_sent) : [pending[0]];
  for (const a of targets) { run(ctx.db, 'UPDATE appointments SET confirmed = 1 WHERE clinic_id = ? AND id = ?', ctx.clinic.id, a.id); enqueueCalendar(ctx.db, ctx.clinic.id, a.id, 'upsert'); }
  ctx.say(`¡Gracias! ✔ Asistencia confirmada:\n\n${targets.map((a) => apptLine(a)).join('\n')}`);
}

// ───────────────────────────── disponibilidad ─────────────────────────────

function startAvailability(ctx: Ctx, text: string): void {
  const { state, db, clinic } = ctx;
  Object.assign(state, freshState());
  const docs = listDoctors(db, clinic.id);
  const doc = matchDoctor(text, docs);
  const allSpecs = listSpecialties(db, clinic.id);
  const walkIn = doc && allSpecs.find((s) => s.id === doc.specialty_id && !isBookable(ctx, s));
  if (walkIn) return startService(ctx, walkIn);   // médico de un servicio sin cita: se informa su horario en vez de «sin horarios»
  const specs = allSpecs.filter((s) => s.kind === 'appointment' && docs.some((d) => d.specialty_id === s.id));
  const sp = doc ? undefined : matchSpecialty(text, specs);
  if (doc || sp) return showAvailability(ctx, doc ? [doc] : docs.filter((d) => d.specialty_id === sp!.id));
  if (text.trim()) {   // pidió un servicio sin cita o con el área (p. ej. Pediatría): se informa en vez de decir «no identifiqué»
    const svc = matchSpecialty(text, listSpecialties(db, clinic.id).filter((s) => !isBookable(ctx, s)));
    if (svc) return startService(ctx, svc);
  }
  if (!specs.length) return ctx.say('Por ahora no tengo médicos cargados para consultar disponibilidad. Escriba *recepción* y una persona le ayudará.');
  state.flow = 'avail'; state.step = 'specialty'; state.options = specs.map((s) => s.id);
  ctx.say(`¿De qué especialidad desea ver la disponibilidad?\n\n${specs.map((s, i) => `*${i + 1}.* ${label(s)}`).join('\n')}`);
}

function availInput(ctx: Ctx, text: string): void {
  const { state, db, clinic } = ctx;
  const c = parseChoice(text, state.options.length);
  const docs = listDoctors(db, clinic.id);
  const doc = matchDoctor(text, docs);
  const walkIn = doc && listSpecialties(db, clinic.id).find((s) => s.id === doc.specialty_id && !isBookable(ctx, s));
  if (walkIn) return startService(ctx, walkIn);
  const spId = c ? state.options[c - 1] : matchSpecialty(text, listSpecialties(db, clinic.id).filter((s) => state.options.includes(s.id)))?.id;
  if (!doc && !spId) {
    const svc = matchSpecialty(text, listSpecialties(db, clinic.id).filter((s) => !isBookable(ctx, s)));
    if (svc) return startService(ctx, svc);   // Pediatría, Ginecología, etc.: se atienden sin cita
    return fail(ctx, 'No identifiqué esa especialidad.', () => startAvailability(ctx, ''));
  }
  Object.assign(state, freshState());
  showAvailability(ctx, doc ? [doc] : docs.filter((d) => d.specialty_id === spId));
}

function showAvailability(ctx: Ctx, docs: Doctor[]): void {
  if (!docs.length) return ctx.say('No hay médicos activos en esa especialidad por ahora.');
  const blocks = docs.map((d) => {
    const slots = pickOptions(freeSlots(ctx.db, ctx.clinic, [d.id], { now: ctx.now }), 0, 3, 2);
    return `*${d.name}* (${d.specialty_name})\n${slots.length ? slots.map((s) => `  • ${humanDate(s.start)}`).join('\n') : '  Sin horarios en los próximos días'}`;
  });
  ctx.say(`📅 *Próximos horarios disponibles*\n\n${blocks.join('\n\n')}\n\nPara reservar escriba *agendar*.`);
}
